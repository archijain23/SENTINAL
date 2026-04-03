const express     = require('express');
const router      = express.Router();
const AttackEvent = require('../models/AttackEvent');
const logger      = require('../utils/logger');

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const [total, bySeverity, byType] = await Promise.all([
      AttackEvent.countDocuments(),
      AttackEvent.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      AttackEvent.aggregate([{ $group: { _id: '$attackType', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }])
    ]);
    res.json({ success: true, data: { total, bySeverity, byType } });
  } catch (err) {
    logger.error('[STATS] query failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
