const express = require('express');
const router  = express.Router();
const Alert   = require('../models/Alert');
const logger  = require('../utils/logger');

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    logger.error('[ALERTS] list failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/alerts/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) {
    logger.error('[ALERTS] mark-read failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
