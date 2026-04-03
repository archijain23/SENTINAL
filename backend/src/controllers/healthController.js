const logger = require('../utils/logger');

/**
 * Health Controller
 * Stage 1 — Skeleton
 * Returns basic server health status.
 */

const getHealth = async (req, res) => {
  try {
    return res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[healthController] getHealth error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
};

module.exports = { getHealth };
