/**
 * BlockedIP Model
 *
 * Stores IPs that have been rate-limited or permanently banned.
 * Supports optional TTL expiry via MongoDB's native TTL index.
 * expiresAt: null = permanent block (TTL index skips nulls via sparse: true)
 */
const mongoose = require('mongoose');

const BlockedIPSchema = new mongoose.Schema(
  {
    ip: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
      trim:     true,
    },
    reason:     { type: String, default: '' },
    attackType: { type: String, default: '' },
    attackId:   { type: String, default: '' },
    blockedAt:  { type: Date,   default: Date.now },
    expiresAt:  { type: Date,   default: null },
    blockedBy:  { type: String, default: 'sentinal-response-engine' },
  },
  { timestamps: true }
);

// MongoDB TTL index — auto-removes document when expiresAt is reached.
// sparse: true means documents with expiresAt: null are NOT deleted (permanent blocks).
BlockedIPSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true }
);

module.exports = mongoose.model('BlockedIP', BlockedIPSchema);
