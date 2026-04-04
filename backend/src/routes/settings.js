/**
 * settings.js — GET /api/settings  &  PUT /api/settings
 *
 * Persists operator-configurable settings to config/settings.json
 * (created on first write). Falls back to DEFAULTS if file missing.
 *
 * No new npm dependencies — uses Node built-ins only.
 */

'use strict';

const express = require('express');
const fs      = require('fs').promises;
const path    = require('path');
const logger  = require('../utils/logger');

const router       = express.Router();
const SETTINGS_PATH = path.resolve(__dirname, '../../config/settings.json');

const DEFAULTS = {
  detection: {
    confidenceThreshold:  0.70,   // 0.0 – 1.0
    severityFloor:        'low',  // low | medium | high | critical
    autoBlockOnCritical:  true,
    autoBlockOnHigh:      false,
  },
  alerts: {
    minSeverity:          'medium', // low | medium | high | critical
    cooldownMinutes:      5,
    maxAlertsPerHour:     50,
    emailNotifications:   false,
  },
  ai: {
    copilotEnabled:       true,
    streamingEnabled:     true,
    correlationEnabled:   true,
    mutationEnabled:      true,
    maxTokens:            1024,
  },
};

async function readSettings() {
  try {
    const raw  = await fs.readFile(SETTINGS_PATH, 'utf8');
    const disk = JSON.parse(raw);
    // Deep merge: disk values override defaults, missing keys fall back
    return {
      detection: { ...DEFAULTS.detection, ...disk.detection },
      alerts:    { ...DEFAULTS.alerts,    ...disk.alerts    },
      ai:        { ...DEFAULTS.ai,        ...disk.ai        },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

async function writeSettings(data) {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── GET /api/settings ────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const settings = await readSettings();

    // Surface API key status (masked) without exposing the key
    const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY);
    const apiKeyMasked     = apiKeyConfigured
      ? '•'.repeat(20) + process.env.GEMINI_API_KEY.slice(-4)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        ...settings,
        apiKey: {
          configured: apiKeyConfigured,
          masked:     apiKeyMasked,
          envVar:     'GEMINI_API_KEY',
        },
      },
    });
  } catch (err) {
    logger.error(`[Settings] GET error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to load settings', code: 'SETTINGS_READ_ERROR' });
  }
});

// ── PUT /api/settings ────────────────────────────────────────────────────────
// Body: partial settings object — only provided sections are merged
router.put('/', async (req, res) => {
  try {
    const body     = req.body || {};
    const current  = await readSettings();

    // Validate + merge detection
    if (body.detection) {
      const d = body.detection;
      if (d.confidenceThreshold !== undefined) {
        const v = parseFloat(d.confidenceThreshold);
        if (isNaN(v) || v < 0 || v > 1)
          return res.status(400).json({ success: false, message: 'confidenceThreshold must be 0.0–1.0', code: 'VALIDATION_ERROR' });
        current.detection.confidenceThreshold = v;
      }
      if (d.severityFloor !== undefined) {
        if (!['low','medium','high','critical'].includes(d.severityFloor))
          return res.status(400).json({ success: false, message: 'severityFloor must be low|medium|high|critical', code: 'VALIDATION_ERROR' });
        current.detection.severityFloor = d.severityFloor;
      }
      if (d.autoBlockOnCritical !== undefined) current.detection.autoBlockOnCritical = Boolean(d.autoBlockOnCritical);
      if (d.autoBlockOnHigh     !== undefined) current.detection.autoBlockOnHigh     = Boolean(d.autoBlockOnHigh);
    }

    // Validate + merge alerts
    if (body.alerts) {
      const a = body.alerts;
      if (a.minSeverity !== undefined) {
        if (!['low','medium','high','critical'].includes(a.minSeverity))
          return res.status(400).json({ success: false, message: 'minSeverity must be low|medium|high|critical', code: 'VALIDATION_ERROR' });
        current.alerts.minSeverity = a.minSeverity;
      }
      if (a.cooldownMinutes !== undefined) {
        const v = parseInt(a.cooldownMinutes, 10);
        if (isNaN(v) || v < 0 || v > 1440)
          return res.status(400).json({ success: false, message: 'cooldownMinutes must be 0–1440', code: 'VALIDATION_ERROR' });
        current.alerts.cooldownMinutes = v;
      }
      if (a.maxAlertsPerHour !== undefined) {
        const v = parseInt(a.maxAlertsPerHour, 10);
        if (isNaN(v) || v < 1 || v > 10000)
          return res.status(400).json({ success: false, message: 'maxAlertsPerHour must be 1–10000', code: 'VALIDATION_ERROR' });
        current.alerts.maxAlertsPerHour = v;
      }
      if (a.emailNotifications !== undefined) current.alerts.emailNotifications = Boolean(a.emailNotifications);
    }

    // Validate + merge ai
    if (body.ai) {
      const ai = body.ai;
      if (ai.copilotEnabled     !== undefined) current.ai.copilotEnabled     = Boolean(ai.copilotEnabled);
      if (ai.streamingEnabled   !== undefined) current.ai.streamingEnabled   = Boolean(ai.streamingEnabled);
      if (ai.correlationEnabled !== undefined) current.ai.correlationEnabled = Boolean(ai.correlationEnabled);
      if (ai.mutationEnabled    !== undefined) current.ai.mutationEnabled    = Boolean(ai.mutationEnabled);
      if (ai.maxTokens !== undefined) {
        const v = parseInt(ai.maxTokens, 10);
        if (isNaN(v) || v < 256 || v > 8192)
          return res.status(400).json({ success: false, message: 'maxTokens must be 256–8192', code: 'VALIDATION_ERROR' });
        current.ai.maxTokens = v;
      }
    }

    await writeSettings(current);
    logger.info('[Settings] Configuration updated');

    return res.status(200).json({ success: true, data: current, message: 'Settings saved' });
  } catch (err) {
    logger.error(`[Settings] PUT error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to save settings', code: 'SETTINGS_WRITE_ERROR' });
  }
});

// ── POST /api/settings/test-api-key ──────────────────────────────────────────
// Tests the current GEMINI_API_KEY by making a minimal API call
router.post('/test-api-key', async (_req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(200).json({ success: true, data: { valid: false, reason: 'GEMINI_API_KEY not set in .env' } });
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] });
    return res.status(200).json({ success: true, data: { valid: true, model: 'gemini-2.5-flash' } });
  } catch (err) {
    const msg = err.message || '';
    const reason = msg.includes('403') || msg.includes('API_KEY_INVALID')
      ? 'API key is invalid or has insufficient permissions'
      : msg.includes('429') ? 'API key valid but rate-limited'
      : msg.includes('404') ? 'Model not found — key may be restricted'
      : `Error: ${msg.slice(0, 120)}`;
    return res.status(200).json({ success: true, data: { valid: false, reason } });
  }
});

module.exports = router;
