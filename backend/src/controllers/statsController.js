const logger = require('../utils/logger');
const AttackEvent = require('../models/AttackEvent');
const Alert = require('../models/Alert');
const BlockedIP = require('../models/BlockedIP');

/**
 * Stats Controller
 * Stage 2 — Basic Functionality
 * Returns real counts queried from MongoDB models.
 */

const getStats = async (req, res) => {
  try {
    const [totalAttacks, totalAlerts, blockedIPs] = await Promise.all([
      AttackEvent.countDocuments(),
      Alert.countDocuments(),
      BlockedIP.countDocuments({ isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalAttacks,
        totalAlerts,
        blockedIPs,
      },
    });
  } catch (err) {
    logger.error('[statsController] getStats error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

module.exports = { getStats };
