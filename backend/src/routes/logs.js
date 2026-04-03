const express    = require('express');
const router     = express.Router();
const SystemLog  = require('../models/SystemLog');
const logger     = require('../utils/logger');

// GET /api/logs
router.get('/', async (req, res) => {
  try {
    const { projectId, limit = 50 } = req.query;
    const filter = projectId ? { projectId } : {};
    const logs = await SystemLog.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    logger.error('[LOGS] list failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
