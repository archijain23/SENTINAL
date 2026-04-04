/**
 * pcap.js — PCAP upload & analysis routes
 *
 * POST /api/pcap/upload  — multer upload → forward to pcap-processor :8003
 *                          Returns 503 PCAP_PROCESSOR_OFFLINE when :8003 is unreachable
 *                          instead of throwing a raw ECONNREFUSED to the frontend.
 * GET  /api/pcap         — list past PCAP sessions from MongoDB (no microservice needed)
 * GET  /api/pcap/jobs    — alias for session list
 * GET  /api/pcap/jobs/:id — single job
 */

const express  = require('express');
const multer   = require('multer');
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const FormData = require('form-data');
const logger   = require('../utils/logger');
const PcapSession = require('../models/PcapSession');

const router = express.Router();

const PCAP_URL = process.env.PCAP_PROCESSOR_URL || 'http://localhost:8003';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = '/tmp/sentinal-uploads';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname) || '.pcap';
    const base = require('crypto').randomBytes(16).toString('hex');
    cb(null, base + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pcap', '.pcapng', '.cap'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error(`Unsupported file type: ${ext}. Only .pcap, .pcapng, .cap are accepted.`));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ── POST /api/pcap/upload ─────────────────────────────────────────────────────
router.post('/upload', upload.single('pcap'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No PCAP file received.', code: 'NO_FILE' });
  }

  const filePath = req.file.path;
  logger.info(`[PCAP] Sending to processor at ${PCAP_URL}: ${filePath}`);

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename:    req.file.originalname,
      contentType: 'application/octet-stream',
    });
    if (req.body.projectId) form.append('projectId', req.body.projectId);

    const response = await axios.post(`${PCAP_URL}/analyze`, form, {
      headers:         form.getHeaders(),
      timeout:         120_000,
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });

    // Persist session metadata to MongoDB
    try {
      await PcapSession.create({
        filename:   req.file.originalname,
        filePath,
        projectId:  req.body.projectId || 'pcap-upload',
        status:     'processed',
        result:     response.data,
        processedAt: new Date(),
      });
    } catch (dbErr) {
      logger.warn(`[PCAP] Failed to persist session: ${dbErr.message}`);
    }

    logger.info(`[PCAP] Processing succeeded: ${req.file.originalname}`);
    return res.status(200).json({ success: true, data: response.data });

  } catch (err) {
    // Clean up temp file on error
    fs.unlink(filePath, () => {});

    // ECONNREFUSED / ENOTFOUND — microservice is not running
    const isOffline = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
                      err.message?.includes('ECONNREFUSED');

    if (isOffline) {
      logger.error(`[PCAP] Processing failed: connect ECONNREFUSED ${PCAP_URL}`);
      return res.status(503).json({
        success: false,
        message: 'PCAP processor is offline. The pcap-processor microservice (port 8003) is not running. ' +
                 'Your file was received but could not be analysed. ' +
                 'Start the microservice and re-upload to process this capture.',
        code: 'PCAP_PROCESSOR_OFFLINE',
        offline: true,
      });
    }

    // Timeout
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      logger.error(`[PCAP] Processing timed out: ${req.file.originalname}`);
      return res.status(504).json({
        success: false,
        message: 'PCAP processor timed out (>120s). The file may be too large or the processor is overloaded.',
        code: 'PCAP_TIMEOUT',
      });
    }

    // Processor returned a non-2xx response
    if (err.response) {
      logger.error(`[PCAP] Processor error ${err.response.status}: ${JSON.stringify(err.response.data)}`);
      return res.status(502).json({
        success: false,
        message: `PCAP processor returned an error: ${err.response.data?.message || err.response.status}`,
        code: 'PCAP_PROCESSOR_ERROR',
      });
    }

    logger.error(`[PCAP] Unexpected error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'PCAP processing failed unexpectedly.', code: 'PCAP_ERROR' });
  }
});

// ── GET /api/pcap  (+ /api/pcap/jobs alias) ───────────────────────────────────
const listSessions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const sessions = await PcapSession
      .find()
      .sort({ processedAt: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({ success: true, data: sessions });
  } catch (err) {
    logger.error(`[PCAP] listSessions error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch PCAP sessions.', code: 'QUERY_ERROR' });
  }
};

router.get('/',     listSessions);
router.get('/jobs', listSessions);

// ── GET /api/pcap/jobs/:id ────────────────────────────────────────────────────
router.get('/jobs/:id', async (req, res) => {
  try {
    const session = await PcapSession.findById(req.params.id).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'PCAP session not found.', code: 'NOT_FOUND' });
    }
    return res.status(200).json({ success: true, data: session });
  } catch (err) {
    logger.error(`[PCAP] getJob error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch PCAP session.', code: 'QUERY_ERROR' });
  }
});

module.exports = router;
