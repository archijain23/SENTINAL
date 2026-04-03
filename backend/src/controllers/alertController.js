const logger = require('../utils/logger');

/**
 * Alert Controller
 * Stage 1 — Skeleton
 * Returns empty alerts list as baseline.
 */

const getAlerts = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err) {
    logger.error('[alertController] getAlerts error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
};

const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Alert ID is required' });
    }
    return res.status(200).json({ success: true, message: 'Alert acknowledged', id });
  } catch (err) {
    logger.error('[alertController] acknowledgeAlert error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge alert' });
  }
};

module.exports = { getAlerts, acknowledgeAlert };
