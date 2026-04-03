/**
 * SENTINAL — BlockedIP Model
 *
 * Stores IPs that have been rate-limited or blocked by the Response Engine.
 * Supports optional TTL expiry via MongoDB's native TTL index.
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

BlockedIPSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, sparse: true }
);

module.exports = mongoose.model('BlockedIP', BlockedIPSchema);
