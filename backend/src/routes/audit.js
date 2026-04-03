const express   = require('express');
const router    = express.Router();
const AuditLog  = require('../models/AuditLog');
const logger    = require('../utils/logger');

// GET /api/audit
router.get('/', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    logger.error('[AUDIT] list failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
