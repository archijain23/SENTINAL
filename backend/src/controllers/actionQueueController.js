const logger = require('../utils/logger');

/**
 * Action Queue Controller
 * Stage 1 — Skeleton
 * Returns empty action queue as baseline.
 */

const getQueue = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err) {
    logger.error('[actionQueueController] getQueue error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch action queue' });
  }
};

const enqueueAction = async (req, res) => {
  try {
    const { type, target } = req.body;
    if (!type || !target) {
      return res.status(400).json({ success: false, message: 'type and target are required' });
    }
    return res.status(202).json({ success: true, message: 'Action queued', type, target });
  } catch (err) {
    logger.error('[actionQueueController] enqueueAction error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to enqueue action' });
  }
};

const updateActionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Action ID is required' });
    }
    return res.status(404).json({ success: false, message: 'Action not found' });
  } catch (err) {
    logger.error('[actionQueueController] updateActionStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update action status' });
  }
};

module.exports = { getQueue, enqueueAction, updateActionStatus };
