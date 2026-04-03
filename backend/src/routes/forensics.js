const express     = require('express');
const router      = express.Router();
const AttackEvent = require('../models/AttackEvent');
const logger      = require('../utils/logger');

// GET /api/forensics/:attackId
router.get('/:attackId', async (req, res) => {
  try {
    const attack = await AttackEvent.findById(req.params.attackId).lean();
    if (!attack) return res.status(404).json({ success: false, message: 'Attack not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: attack });
  } catch (err) {
    logger.error(`[FORENSICS] lookup failed: ${err.message}`);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
