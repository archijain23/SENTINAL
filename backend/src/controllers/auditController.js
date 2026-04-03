const logger = require('../utils/logger');

/**
 * Audit Controller
 * Stage 1 — Skeleton
 * Returns empty audit log list as baseline.
 */

const getAuditLogs = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [],
      total: 0,
    });
  } catch (err) {
    logger.error('[auditController] getAuditLogs error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

module.exports = { getAuditLogs };
