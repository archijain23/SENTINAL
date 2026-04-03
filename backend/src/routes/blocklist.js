/**
 * SENTINAL — Blocklist Routes
 * GET    /api/blocklist            — list all active blocked IPs
 * GET    /api/blocklist/check/:ip  — single-IP check
 * POST   /api/blocklist            — block an IP
 * DELETE /api/blocklist/:ip        — unblock an IP
 */
const express   = require('express');
const router    = express.Router();
const BlockedIP = require('../models/BlockedIP');
const logger    = require('../utils/logger');

const activeFilter = (ip) => ({
  ...(ip ? { ip } : {}),
  $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

router.get('/', async (req, res) => {
  try {
    const list = await BlockedIP.find(activeFilter()).sort({ blockedAt: -1 }).lean();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    logger.error('[BLOCKLIST] list failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
});

router.get('/check/:ip', async (req, res) => {
  try {
    const blocked = await BlockedIP.findOne(activeFilter(req.params.ip)).lean();
    res.json({ blocked: !!blocked, data: blocked || null });
  } catch (err) {
    logger.error(`[BLOCKLIST] check failed for ip=${req.params.ip}:`, err.message);
    res.json({ blocked: false, data: null });
  }
});

router.post('/', async (req, res) => {
  try {
    const { ip, reason, attackType, attackId, durationMinutes, blockedBy } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'ip is required', code: 'BAD_REQUEST' });

    const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

    const entry = await BlockedIP.findOneAndUpdate(
      { ip },
      { ip, reason: reason || '', attackType: attackType || '', attackId: attackId || '',
        expiresAt, blockedAt: new Date(), blockedBy: blockedBy || 'sentinal-response-engine' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`[BLOCKLIST] Blocked ip=${ip} expires=${expiresAt || 'never'}`);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    logger.error('[BLOCKLIST] block failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
});

router.delete('/:ip', async (req, res) => {
  try {
    const result = await BlockedIP.deleteOne({ ip: req.params.ip });
    if (result.deletedCount === 0)
      return res.status(404).json({ success: false, message: 'IP not found in blocklist', code: 'NOT_FOUND' });
    logger.info(`[BLOCKLIST] Unblocked ip=${req.params.ip}`);
    res.json({ success: true, message: `${req.params.ip} has been unblocked` });
  } catch (err) {
    logger.error('[BLOCKLIST] unblock failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
