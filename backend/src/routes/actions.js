const express      = require('express');
const router       = express.Router();
const ActionQueue  = require('../models/ActionQueue');
const logger       = require('../utils/logger');

// GET /api/actions/pending
router.get('/pending', async (req, res) => {
  try {
    const actions = await ActionQueue.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: actions.length, data: actions });
  } catch (err) {
    logger.error('[ACTIONS] list failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/actions/:id/approve
router.patch('/:id/approve', async (req, res) => {
  try {
    const action = await ActionQueue.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedBy: req.body.approvedBy || 'admin', approvedAt: new Date() },
      { new: true }
    );
    if (!action) return res.status(404).json({ success: false, message: 'Action not found' });
    logger.info(`[ACTIONS] Approved action ${req.params.id}`);
    res.json({ success: true, data: action });
  } catch (err) {
    logger.error('[ACTIONS] approve failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/actions/:id/reject
router.patch('/:id/reject', async (req, res) => {
  try {
    const action = await ActionQueue.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', blockedReason: req.body.reason || '' },
      { new: true }
    );
    if (!action) return res.status(404).json({ success: false, message: 'Action not found' });
    logger.info(`[ACTIONS] Rejected action ${req.params.id}`);
    res.json({ success: true, data: action });
  } catch (err) {
    logger.error('[ACTIONS] reject failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
