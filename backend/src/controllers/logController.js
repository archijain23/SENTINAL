const logger = require('../utils/logger');

/**
 * Log Controller
 * Stage 1 — Skeleton
 * Returns empty logs array as baseline.
 */

const getLogs = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err) {
    logger.error('[logController] getLogs error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

module.exports = { getLogs };
