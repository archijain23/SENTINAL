const logger = require('../utils/logger');

/**
 * Atlas Search Controller
 * Stage 1 — Skeleton
 * Returns empty search results as baseline.
 * Will later integrate MongoDB Atlas full-text search.
 */

const searchAttacks = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
      query: req.query.q || '',
    });
  } catch (err) {
    logger.error('[atlasSearchController] searchAttacks error:', err.message);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
};

const searchAlerts = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
      query: req.query.q || '',
    });
  } catch (err) {
    logger.error('[atlasSearchController] searchAlerts error:', err.message);
    return res.status(500).json({ success: false, message: 'Alert search failed' });
  }
};

module.exports = { searchAttacks, searchAlerts };
