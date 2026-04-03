const logger = require('../utils/logger');

/**
 * Stats Controller
 * Stage 1 — Skeleton
 * Returns placeholder dashboard stat counts.
 */

const getStats = async (req, res) => {
  try {
    return res.status(200).json({
      totalAttacks: 0,
      totalAlerts: 0,
      blockedIPs: 0,
      activeSessions: 0,
    });
  } catch (err) {
    logger.error('[statsController] getStats error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch stats' });
  }
};

module.exports = { getStats };
