const logger = require('../utils/logger');
const Alert = require('../models/Alert');

/**
 * Alert Controller
 * Stage 2 — Basic Functionality
 * Queries real Alert documents with pagination and acknowledge support.
 */

// GET /api/alerts
const getAlerts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const skip  = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      Alert.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      count: alerts.length,
      data: alerts,
    });
  } catch (err) {
    logger.error('[alertController] getAlerts error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
};

// PATCH /api/alerts/:id/acknowledge
const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await Alert.findByIdAndUpdate(
      id,
      { isRead: true, acknowledgedAt: new Date() },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    logger.info(`[alertController] Alert acknowledged: ${id}`);
    return res.status(200).json({ success: true, data: alert });
  } catch (err) {
    logger.error('[alertController] acknowledgeAlert error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to acknowledge alert' });
  }
};

module.exports = { getAlerts, acknowledgeAlert };
