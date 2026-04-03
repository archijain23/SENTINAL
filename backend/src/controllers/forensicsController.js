const logger = require('../utils/logger');

/**
 * Forensics Controller
 * Stage 1 — Skeleton
 * Returns empty forensics report as baseline.
 */

const getForensicsReport = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err) {
    logger.error('[forensicsController] getForensicsReport error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch forensics report' });
  }
};

const getForensicsById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }
    return res.status(404).json({ success: false, message: 'Forensics record not found' });
  } catch (err) {
    logger.error('[forensicsController] getForensicsById error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch forensics record' });
  }
};

module.exports = { getForensicsReport, getForensicsById };
