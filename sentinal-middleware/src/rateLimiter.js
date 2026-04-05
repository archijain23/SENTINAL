const rateLimit = require('express-rate-limit');

/**
 * ingestLimiter
 * Strict limiter for ingest/attack-report routes.
 * Allows 100 requests per IP per minute.
 */
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute window
  max: 100,               // max 100 requests per IP
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  message: {
    success: false,
    message: 'Too many requests — slow down',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

/**
 * globalLimiter
 * Permissive limiter for general routes.
 * Allows 300 requests per IP per minute.
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

module.exports = { ingestLimiter, globalLimiter };
