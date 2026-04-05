/**
 * sentinal-middleware
 * AI-powered Express.js middleware extracted from the SENTINAL WAF project.
 *
 * Usage:
 *   const { ingestLimiter, globalLimiter, validate } = require('sentinal-middleware');
 *
 * Exports:
 *   - ingestLimiter  : Rate limiter for ingest routes (100 req/min per IP)
 *   - globalLimiter  : Global rate limiter (300 req/min per IP)
 *   - validate       : Joi schema-based request body validator
 */

const { ingestLimiter, globalLimiter } = require('./src/rateLimiter');
const validate = require('./src/validate');

module.exports = {
  ingestLimiter,
  globalLimiter,
  validate
};
