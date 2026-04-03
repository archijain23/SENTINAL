'use strict';
const mongoose = require('mongoose');
const os = require('os');

const _startTime = Date.now();

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting', 99: 'uninitialized' };

const getHealth = (req, res) => {
  const dbReadyState = mongoose.connection.readyState;
  const uptimeSeconds = Math.floor((Date.now() - _startTime) / 1000);
  const response = {
    status:    'ok',
    service:   'gateway',
    version:   '1.0.0',
    uptime:    uptimeSeconds,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port:      parseInt(process.env.GATEWAY_PORT || process.env.PORT || '3000'),
    database:  { status: DB_STATES[dbReadyState] || 'unknown', connected: dbReadyState === 1 },
    services:  { detection: process.env.DETECTION_URL || process.env.DETECTION_ENGINE_URL || 'http://localhost:8002', pcap: process.env.PCAP_URL || process.env.PCAP_SERVICE_URL || 'http://localhost:8003', nexus: process.env.NEXUS_URL || 'http://localhost:8004' },
    memory:    { heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024) }
  };
  const httpStatus = dbReadyState === 1 ? 200 : 503;
  res.status(httpStatus).json(response);
};

module.exports = { getHealth };
