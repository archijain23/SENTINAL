const logger = require('../utils/logger');
const AttackEvent = require('../models/AttackEvent');

/**
 * Attack Controller
 * Stage 2 — Basic Functionality
 * report() fields aligned with Joi reportSchema:
 *   requestId, ip, attackType, severity, status, detectedBy,
 *   confidence, payload, explanation, mitigationSuggestion, responseCode
 */

// POST /api/attacks/report
const report = async (req, res) => {
  try {
    const {
      requestId, ip, attackType, severity, status,
      detectedBy, confidence, payload,
      explanation, mitigationSuggestion, responseCode
    } = req.body;

    const event = new AttackEvent({
      requestId,
      ip,
      attackType,
      severity,
      status,
      detectedBy,
      confidence,
      payload,
      explanation,
      mitigationSuggestion,
      responseCode,
      timestamp: new Date(),
    });

    await event.save();
    logger.info(`[attackController] attack reported: ${attackType} from ${ip}`);
    return res.status(201).json({ success: true, data: event });
  } catch (err) {
    logger.error('[attackController] report error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to report attack' });
  }
};

// GET /api/attacks/recent
const getRecent = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const attacks = await AttackEvent.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({ success: true, count: attacks.length, data: attacks });
  } catch (err) {
    logger.error('[attackController] getRecent error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent attacks' });
  }
};

module.exports = { report, getRecent };
