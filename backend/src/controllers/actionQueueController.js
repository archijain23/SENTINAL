/**
 * actionQueueController
 *
 * CRITICAL FIX v3:
 *   - Added getHistory() handler (GET /api/actions/history)
 *   - Handles both 'rate_limit_ip' AND 'permanent_ban_ip' actions.
 *
 * Nexus queues two types of IP block actions:
 *   - rate_limit_ip     → temporary block (BLOCK_DURATION_MINUTES, default 60min)
 *   - permanent_ban_ip  → permanent block (expiresAt: null, never auto-deleted)
 *
 * Both write directly to BlockedIP MongoDB collection inside the Gateway.
 * No Python / Response Engine process required.
 */
const ActionQueue = require('../models/ActionQueue');
const AuditLog    = require('../models/AuditLog');
const BlockedIP   = require('../models/BlockedIP');
const emitter     = require('../utils/eventEmitter');
const logger      = require('../utils/logger');

const BLOCK_DURATION_MINUTES = parseInt(process.env.BLOCK_DURATION_MINUTES || '60', 10);

/**
 * Execute the approved action directly inside the Gateway.
 * Returns { success: bool, detail: string }
 */
async function _executeApprovedAction(item) {
  const { action, ip, attackId, agentReason } = item;

  if (action === 'rate_limit_ip' || action === 'permanent_ban_ip') {
    if (!ip || ip === 'unknown') {
      return { success: false, detail: `No valid IP to block for action '${action}'` };
    }

    const isPermanent = action === 'permanent_ban_ip';
    const expiresAt   = isPermanent
      ? null
      : BLOCK_DURATION_MINUTES > 0
        ? new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000)
        : null;

    await BlockedIP.findOneAndUpdate(
      { ip },
      {
        ip,
        reason:     agentReason || `${action} approved via Action Queue`,
        attackType: 'nexus-approved',
        attackId:   attackId ? String(attackId) : '',
        expiresAt,
        blockedAt:  new Date(),
        blockedBy:  item.approvedBy || 'human',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const expiryLabel = expiresAt ? expiresAt.toISOString() : 'never (permanent)';
    logger.info(
      `[ACTIONS] ✓ ${action} executed: ${ip} blocked in MongoDB (expires=${expiryLabel})`
    );
    return {
      success: true,
      detail:  `${ip} written to BlockedIP — ${isPermanent ? 'PERMANENT' : `expires in ${BLOCK_DURATION_MINUTES}min`}`,
    };
  }

  logger.info(`[ACTIONS] action='${action}' approved — no Gateway-side execution needed`);
  return { success: true, detail: `${action} acknowledged (no Gateway-side execution)` };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/actions/pending
// ─────────────────────────────────────────────────────────────────────────────
const getPending = async (req, res) => {
  try {
    const items = await ActionQueue.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-__v');
    res.json({ success: true, message: 'Pending actions', data: items });
  } catch (err) {
    logger.error('[ACTIONS] getPending failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/actions/history?limit=50
// Returns actions that have already been decided (approved or rejected).
// Reads directly from the local MongoDB ActionQueue collection —
// no dependency on the Response Engine microservice.
// ─────────────────────────────────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const items = await ActionQueue.find({
      status: { $in: ['approved', 'rejected'] },
    })
      .sort({ updatedAt: -1, approvedAt: -1 })
      .limit(limit)
      .select('-__v');

    // Normalise field names so the frontend receives a consistent shape
    // regardless of which version of the model created the document.
    const normalised = items.map(doc => {
      const obj = doc.toObject();
      return {
        ...obj,
        decision:   obj.status,                              // 'approved' | 'rejected'
        decidedBy:  obj.approvedBy  || obj.rejectedBy || obj.decidedBy || 'system',
        decidedAt:  obj.approvedAt  || obj.rejectedAt || obj.updatedAt,
        targetIP:   obj.ip          || obj.targetIP   || null,
        action:     obj.action      || obj.type        || 'unknown',
      };
    });

    res.json({ success: true, message: 'Action history', data: normalised });
  } catch (err) {
    logger.error('[ACTIONS] getHistory failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/actions/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
const approveAction = async (req, res) => {
  try {
    const item = await ActionQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Action not found', code: 'NOT_FOUND' });
    if (item.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Action is not pending', code: 'BAD_REQUEST' });
    }

    item.status     = 'approved';
    item.approvedBy = req.body.approvedBy || 'human';
    item.approvedAt = new Date();
    await item.save();

    const execResult = await _executeApprovedAction(item);
    if (!execResult.success) {
      logger.warn(`[ACTIONS] Execution warning for ${item.action}: ${execResult.detail}`);
    }

    await AuditLog.create({
      action:            item.action,
      status:            'APPROVED',
      reason:            `Human approved. Execution: ${execResult.detail}`,
      policy_rule_id:    'HUMAN_OVERRIDE',
      enforcement_level: 'nexus-policy-v1',
      triggeredBy:       'human',
      ip:                item.ip,
      attackId:          item.attackId ? String(item.attackId) : null,
      meta:              { actionQueueId: String(item._id), executed: execResult.success, executionDetail: execResult.detail }
    });

    logger.info(`[ACTIONS] APPROVED + EXECUTED: ${item.action} for ip=${item.ip} attackId=${item.attackId}`);
    res.json({
      success:   true,
      message:   'Action approved and executed',
      data:      item,
      execution: execResult,
    });
  } catch (err) {
    logger.error('[ACTIONS] approveAction failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/actions/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
const rejectAction = async (req, res) => {
  try {
    const item = await ActionQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Action not found', code: 'NOT_FOUND' });
    if (item.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Action is not pending', code: 'BAD_REQUEST' });
    }

    item.status     = 'rejected';
    item.approvedBy = req.body.rejectedBy || 'human';
    item.approvedAt = new Date();
    await item.save();

    await AuditLog.create({
      action:            item.action,
      status:            'REJECTED',
      reason:            'Human rejected pending action',
      policy_rule_id:    'HUMAN_OVERRIDE',
      enforcement_level: 'nexus-policy-v1',
      triggeredBy:       'human',
      ip:                item.ip,
      attackId:          item.attackId ? String(item.attackId) : null,
      meta:              { actionQueueId: String(item._id) }
    });

    logger.info(`[ACTIONS] REJECTED: ${item.action} for attackId=${item.attackId}`);
    res.json({ success: true, message: 'Action rejected', data: item });
  } catch (err) {
    logger.error('[ACTIONS] rejectAction failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

module.exports = { getPending, getHistory, approveAction, rejectAction };
