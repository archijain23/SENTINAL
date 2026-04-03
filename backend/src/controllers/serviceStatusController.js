const logger = require('../utils/logger');

/**
 * Service Status Controller
 * Stage 1 — Skeleton
 * Returns empty services list as baseline.
 */

const getServiceStatus = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
    });
  } catch (err) {
    logger.error('[serviceStatusController] getServiceStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch service status' });
  }
};

module.exports = { getServiceStatus };
