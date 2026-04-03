const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

/**
 * Audit Controller
 * Stage 2 — Basic Functionality
 * Queries real AuditLog documents with optional action filter and pagination.
 */

// GET /api/audit
const getAuditLogs = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 100, 200);
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const skip   = (page - 1) * limit;
    const filter = {};

    if (req.query.action) filter.action = req.query.action;
    if (req.query.actor)  filter.actor  = { $regex: req.query.actor, $options: 'i' };

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      count: logs.length,
      data: logs,
    });
  } catch (err) {
    logger.error('[auditController] getAuditLogs error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

module.exports = { getAuditLogs };
