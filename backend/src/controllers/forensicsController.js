const logger = require('../utils/logger');
const AttackEvent = require('../models/AttackEvent');

/**
 * Forensics Controller
 * Stage 2 — Basic Functionality
 * Fetches full attack event detail by ID for forensic analysis.
 */

// GET /api/forensics
const getForensicsReport = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter = {};
    if (req.query.attackType) filter.attackType = req.query.attackType;
    if (req.query.severity)   filter.severity   = req.query.severity;

    const events = await AttackEvent.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (err) {
    logger.error('[forensicsController] getForensicsReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch forensics report' });
  }
};

// GET /api/forensics/:id
const getForensicsById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await AttackEvent.findById(id).lean();
    if (!event) {
      return res.status(404).json({ success: false, message: 'Attack event not found', code: 'NOT_FOUND' });
    }
    logger.info(`[forensicsController] Forensics fetched for event: ${id}`);
    return res.status(200).json({ success: true, data: event });
  } catch (err) {
    logger.error('[forensicsController] getForensicsById error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch forensics record' });
  }
};

module.exports = { getForensicsReport, getForensicsById };
