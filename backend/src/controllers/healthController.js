const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Health Controller
 * Stage 2 — Basic Functionality
 * Returns server uptime + live MongoDB connection state.
 */

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

const getHealth = async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    return res.status(200).json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: DB_STATES[dbState] || 'unknown',
        connected: dbState === 1,
      },
    });
  } catch (err) {
    logger.error('[healthController] getHealth error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
};

module.exports = { getHealth };
