const logger = require('../utils/logger');
const AttackEvent = require('../models/AttackEvent');

/**
 * Atlas Search Controller
 * Stage 2 — Basic Functionality
 * Exports exactly the function names the attacks route expects:
 *   searchAttacks, searchStats
 */

// GET /api/attacks/search?q=<term>
const searchAttacks = async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.status(400).json({ success: false, message: 'Query parameter q is required' });
    }
    const results = await AttackEvent.find({
      $or: [
        { attackType: { $regex: q, $options: 'i' } },
        { sourceIP:   { $regex: q, $options: 'i' } },
        { targetIP:   { $regex: q, $options: 'i' } },
      ],
    })
      .sort({ detectedAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({ success: true, count: results.length, data: results, query: q });
  } catch (err) {
    logger.error('[atlasSearchController] searchAttacks error:', err.message);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
};

// GET /api/attacks/search/stats
const searchStats = async (req, res) => {
  try {
    const q = req.query.q || '';
    const match = q.trim()
      ? {
          $or: [
            { attackType: { $regex: q, $options: 'i' } },
            { sourceIP:   { $regex: q, $options: 'i' } },
          ],
        }
      : {};
    const [total, bySeverity] = await Promise.all([
      AttackEvent.countDocuments(match),
      AttackEvent.aggregate([
        { $match: match },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
    ]);
    return res.status(200).json({ success: true, data: { total, bySeverity }, query: q });
  } catch (err) {
    logger.error('[atlasSearchController] searchStats error:', err.message);
    return res.status(500).json({ success: false, message: 'Stats search failed' });
  }
};

module.exports = { searchAttacks, searchStats };
