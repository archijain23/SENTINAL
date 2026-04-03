const express       = require('express');
const router        = express.Router();
const ServiceStatus = require('../models/ServiceStatus');
const logger        = require('../utils/logger');

// GET /api/services
router.get('/', async (req, res) => {
  try {
    const statuses = await ServiceStatus.find().lean();
    res.json({ success: true, data: statuses });
  } catch (err) {
    logger.error('[SERVICE-STATUS] list failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
