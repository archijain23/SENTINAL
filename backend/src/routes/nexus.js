/**
 * Nexus Trigger Route
 * POST /api/nexus/trigger
 * Creates a real SystemLog + AttackEvent, then triggers Nexus enforcement.
 */
const express       = require('express');
const router        = express.Router();
const SystemLog     = require('../models/SystemLog');
const attackService = require('../services/attackService');
const logger        = require('../utils/logger');

const VALID_SEVERITIES   = ['low', 'medium', 'high', 'critical'];
const VALID_ATTACK_TYPES = ['sqli','xss','traversal','command_injection','ssrf','lfi_rfi','brute_force','hpp','xxe','webshell','unknown'];

const TYPE_DESCRIPTIONS = {
  sqli: 'SQL Injection — attacker injected malicious SQL into a query parameter.',
  xss: 'Cross-Site Scripting — attacker injected a client-side script.',
  traversal: 'Path Traversal — attacker used "../" sequences to read files outside the web root.',
  command_injection: 'Command Injection — attacker embedded OS commands in user input.',
  ssrf: 'SSRF — attacker forced the server to make unauthorized internal HTTP requests.',
  lfi_rfi: 'LFI/RFI — attacker included arbitrary files to leak source or execute remote payloads.',
  brute_force: 'Brute Force — repeated login attempts to guess valid credentials.',
  hpp: 'HTTP Parameter Pollution — injected duplicate parameters to bypass validation.',
  xxe: 'XXE — malicious external entity in XML payload to read files or trigger SSRF.',
  webshell: 'Webshell Upload — attempted to upload or access a backdoor script.',
  unknown: 'Unknown Attack Pattern — anomalous request not matching known signatures.',
};

const IMPACT_MAP = {
  critical: 'Full system compromise possible if not blocked immediately.',
  high:     'Significant risk of unauthorized data access or privilege escalation.',
  medium:   'Partial information disclosure or degraded service integrity.',
  low:      'Limited impact; may be reconnaissance or scanner activity.',
};

const ACTION_MAP = {
  sqli: 'Block the IP, sanitize query parameters, enforce parameterized queries.',
  xss: 'Block the IP, enforce strict CSP headers, sanitize all user-controlled output.',
  traversal: 'Block the IP, restrict filesystem access, validate all file path inputs.',
  command_injection: 'Block the IP immediately, audit shell-calling code, switch to safe APIs.',
  ssrf: 'Block the IP, enforce outbound allowlist, disable unused internal endpoints.',
  lfi_rfi: 'Block the IP, disable remote file inclusion, validate all include paths.',
  brute_force: 'Block the IP, enforce MFA, implement exponential backoff on login failures.',
  hpp: 'Block the IP, normalize parameter handling, reject duplicate keys.',
  xxe: 'Block the IP, disable external entity processing, switch to JSON where possible.',
  webshell: 'Block the IP, scan upload directories, restrict upload MIME types.',
  unknown: 'Flag for manual review, apply rate limiting to the source IP.',
};

const buildSimulatedExplanation = (attackType, severity) =>
  JSON.stringify({
    summary: `${severity.toUpperCase()} severity ${attackType.replace(/_/g, ' ')} attack detected`,
    what_happened: TYPE_DESCRIPTIONS[attackType] || `Simulated ${attackType} attack triggered via Nexus demo route.`,
    potential_impact: IMPACT_MAP[severity] || 'Impact depends on attack type and target surface.',
    recommended_action: ACTION_MAP[attackType] || 'Nexus will evaluate and enforce policy automatically.',
    rule_triggered: 'DEMO_SIMULATE',
    source: 'static',
  });

router.post('/trigger', async (req, res) => {
  try {
    const { ip = '10.0.0.1', attackType = 'sqli', severity = 'critical', confidence = 0.97, status = 'successful' } = req.body;

    if (!VALID_SEVERITIES.includes(severity))
      return res.status(400).json({ success: false, message: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`, code: 'VALIDATION_ERROR' });
    if (!VALID_ATTACK_TYPES.includes(attackType))
      return res.status(400).json({ success: false, message: `attackType must be one of: ${VALID_ATTACK_TYPES.join(', ')}`, code: 'VALIDATION_ERROR' });

    logger.info(`[NEXUS-TRIGGER] Simulating ${attackType} from ${ip} (${severity})`);

    const demoLog = await SystemLog.create({
      projectId: 'nexus-demo', method: 'GET', url: `/demo/${attackType}-attack`, ip,
      queryParams: {}, body: {}, headers: { userAgent: 'nexus-demo', contentType: '', referer: '' }, responseCode: 200
    });

    const attack = await attackService.reportAttack({
      requestId: demoLog._id, ip, attackType, severity, status,
      detectedBy: 'rule', confidence: parseFloat(confidence) || 0.97,
      payload: `/demo/${attackType}-attack`,
      explanation: buildSimulatedExplanation(attackType, severity),
      mitigationSuggestion: ACTION_MAP[attackType] || 'Nexus will evaluate and enforce policy',
      responseCode: 200
    });

    logger.info(`[NEXUS-TRIGGER] AttackEvent created: ${attack._id}`);

    res.status(201).json({
      success: true,
      message: 'Attack simulated — Nexus enforcement triggered',
      data: { attackId: attack._id, logId: demoLog._id, ip, attackType, severity, confidence,
              note: 'Check /api/actions/pending and /api/audit in ~2 seconds' }
    });
  } catch (err) {
    logger.error(`[NEXUS-TRIGGER] Error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Trigger failed', code: 'SERVER_ERROR', detail: err.message });
  }
});

module.exports = router;
