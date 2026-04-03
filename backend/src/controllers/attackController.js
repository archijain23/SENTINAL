const logger = require('../utils/logger');
const AttackEvent = require('../models/AttackEvent');

/**
 * Attack Controller
 * Stage 2 — Basic Functionality
 * Exports exactly the function names the attacks route expects:
 *   report, getRecent
 */

// POST /api/attacks/report
const report = async (req, res) => {
  try {
    const { attackType, severity, sourceIP, targetIP, payload, port } = req.body;
    const event = new AttackEvent({
      attackType,
      severity,
      sourceIP,
      targetIP,
      payload,
      port,
      detectedAt: new Date(),
    });
    await event.save();
    logger.info(`[attackController] New attack reported: ${attackType} from ${sourceIP}`);
    return res.status(201).json({ success: true, data: event });
  } catch (err) {
    logger.error('[attackController] report error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to report attack' });
  }
};

// GET /api/attacks/recent
const getRecent = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const attacks = await AttackEvent.find()
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({ success: true, count: attacks.length, data: attacks });
  } catch (err) {
    logger.error('[attackController] getRecent error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent attacks' });
  }
};

module.exports = { report, getRecent };
