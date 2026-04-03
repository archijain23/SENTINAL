/**
 * geminiService.js — SENTINAL Gemini AI integration
 *
 * Verified free-tier model chain (April 2026):
 *   1. gemini-2.0-flash   — stable GA, 15 RPM, 1500 RPD — primary
 *   2. gemini-1.5-flash   — stable GA, 15 RPM,  500 RPD — fallback if 2.0 exhausted
 *
 * Capabilities:
 *   1. chat()           — Security Co-Pilot Q&A grounded in live attack telemetry
 *   2. chatStream()     — Streaming version of chat()
 *   3. generateReport() — Structured incident report for a single attack
 *   4. correlate()      — Campaign correlation across up to 200 recent attacks
 *   5. mutate()         — Payload evasion variant generator (5 WAF-bypass mutations)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const MODEL_CHAIN = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

let _genAI  = null;
let _models = null;

function getModels() {
  if (_models) return _models;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _genAI  = new GoogleGenerativeAI(key);
  _models = MODEL_CHAIN.map(name => _genAI.getGenerativeModel({ model: name }));
  return _models;
}

function resetModels() { _genAI = null; _models = null; }

function getRetryDelay(errMessage, defaultMs = 20_000) {
  const match = errMessage && errMessage.match(/retry(?:Delay)?[":\s]+([0-9.]+)s/i);
  if (match) {
    const s = parseFloat(match[1]);
    if (!isNaN(s) && s > 0) return Math.ceil(s) * 1000;
  }
  return defaultMs;
}

const PLATFORM_KNOWLEDGE = `
You are embedded inside SENTINAL — a real-time threat detection and response platform.
You have full knowledge of every page and feature. Use this knowledge to give analysts
exact navigation steps whenever your answer involves doing something in the UI.

PLATFORM PAGES & FEATURES:

1. /dashboard — Live KPIs, attack charts, recent activity feed
2. /attacks — Full attack events table with Forensics and Report buttons per row
3. /alerts — System alerts with severity badges, mark read/unread
4. /logs — Raw HTTP request logs from all monitored services
5. /pcap — Upload .pcap files for AI-powered packet analysis
6. /action-queue — AI-suggested remediation actions awaiting human approval/rejection
7. /audit — Immutable audit log of all actions (AI + human)
8. /services — Health status dashboard for all monitored upstream services
9. /copilot — Natural language Q&A with streaming responses and follow-up suggestions
10. /correlation — Attack campaign correlation engine with risk score trending
11. /simulate — Payload mutation engine generating 5 WAF-bypass variants
12. /settings — Detection thresholds, alert rules, notification preferences

GUIDELINES:
- Give exact numbered steps with page names and button labels when the analyst needs to act
- Ground answers in the provided telemetry data
- Be direct and actionable
`;

async function generateWithFallback(prompt) {
  const models = getModels();
  if (!models) return null;

  for (let m = 0; m < models.length; m++) {
    const modelName = MODEL_CHAIN[m];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await models[m].generateContent(prompt);
        logger.info(`[GeminiService] ✓ ${modelName} responded (attempt ${attempt})`);
        return result.response.text().trim();
      } catch (err) {
        const msg   = err.message || '';
        const is429 = msg.includes('429');
        const is404 = msg.includes('404');

        if (is404) {
          logger.warn(`[GeminiService] 404: model ${modelName} not found — trying next model.`);
          break;
        }
        if (is429 && attempt === 1) {
          const delay = getRetryDelay(msg);
          logger.warn(`[GeminiService] ${modelName} rate-limited, retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (is429 && attempt === 2) {
          logger.warn(`[GeminiService] ${modelName} still rate-limited — moving to next model`);
          break;
        }
        throw err;
      }
    }
  }

  const quotaErr = new Error('QUOTA_EXHAUSTED');
  quotaErr.isQuotaError = true;
  throw quotaErr;
}

async function* generateStreamWithFallback(prompt) {
  const models = getModels();
  if (!models) return;

  for (let m = 0; m < models.length; m++) {
    const modelName = MODEL_CHAIN[m];
    try {
      const result = await models[m].generateContentStream(prompt);
      logger.info(`[GeminiService] ✓ ${modelName} streaming`);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
      return;
    } catch (err) {
      const msg   = err.message || '';
      const is429 = msg.includes('429');
      const is404 = msg.includes('404');
      if (is404 || is429) {
        logger.warn(`[GeminiService] ${modelName} unavailable on stream — trying next model.`);
        continue;
      }
      throw err;
    }
  }

  const quotaErr = new Error('QUOTA_EXHAUSTED');
  quotaErr.isQuotaError = true;
  throw quotaErr;
}

function stripFences(text) {
  return text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}
function safeParseJSON(text) {
  try { return JSON.parse(stripFences(text)); } catch { return null; }
}

function buildAttackContext(attacks) {
  if (!attacks || !attacks.length) return { context: 'No recent attack data available.', indexedIds: [] };
  const indexedIds = [];
  const lines = attacks
    .slice(0, 50)
    .map((a, i) => {
      indexedIds.push(a._id ? String(a._id) : null);
      return (
        `[${i + 1}] id=${a._id || 'unknown'} type=${a.attackType} severity=${a.severity} status=${a.status} ` +
        `ip=${a.ip || 'unknown'} detectedBy=${a.detectedBy || 'unknown'} ` +
        `confidence=${a.confidence != null ? Math.round(a.confidence * 100) + '%' : '?'} ` +
        `payload=${String(a.payload || '').slice(0, 80)} ` +
        `ts=${a.timestamp ? new Date(a.timestamp).toISOString() : 'unknown'}`
      );
    });
  return { context: lines.join('\n'), indexedIds };
}

function quotaFallback(errorCode) {
  const answer = errorCode === 'QUOTA_EXHAUSTED'
    ? 'The AI Co-Pilot has reached its free-tier API quota for today. Quota resets daily at midnight Pacific time.'
    : 'Gemini API key is not configured. Add GEMINI_API_KEY to your .env file.';
  return { answer, grounded: false, errorCode, suggestions: [], sourcedEventIds: [] };
}

function buildHistoryBlock(history) {
  if (!history || !history.length) return '';
  return '\nCONVERSATION HISTORY (most recent last):\n' +
    history.slice(-6).map(h =>
      `${h.role === 'user' ? 'Analyst' : 'SENTINEL AI'}: ${h.text}`
    ).join('\n') + '\n';
}

const STEPS_FORMAT_INSTRUCTION =
  `If your answer involves taking an action in the SENTINAL UI, include a STEPS: block like:\n` +
  `STEPS:\n1. Go to [Page Name] (/route)\n2. [Exact action]\n3. [Next action]\n` +
  `Only include STEPS: if the analyst needs to DO something. Omit it for pure data questions.`;

async function chat(question, recentAttacks, history = []) {
  if (!getModels()) return quotaFallback('NO_API_KEY');

  const { context, indexedIds } = buildAttackContext(recentAttacks);
  const historyBlock = buildHistoryBlock(history);

  const prompt =
    `You are SENTINEL AI, a senior cybersecurity analyst embedded in the SENTINAL threat detection platform.\n` +
    PLATFORM_KNOWLEDGE + '\n' +
    `LIVE ATTACK TELEMETRY (last 24h):\n${context}\n` +
    historyBlock +
    `\nAnswer the analyst's question. Be direct and actionable.\n` +
    STEPS_FORMAT_INSTRUCTION + '\n' +
    `Do NOT fabricate events not in the data. Keep answer under 350 words. Plain text only.\n` +
    `\nAfter your full answer, on a NEW LINE write exactly:\n` +
    `SUGGESTIONS: ["follow-up question 1?", "follow-up question 2?", "follow-up question 3?"]\n` +
    `SOURCES: [list the index numbers from the telemetry you used, e.g. 1,3,7]\n` +
    `\nQuestion: ${question}`;

  try {
    const raw = await generateWithFallback(prompt);
    if (raw === null) return quotaFallback('NO_API_KEY');

    let answer = raw;
    let suggestions = [];
    let sourcedEventIds = [];

    const sugMatch = raw.match(/SUGGESTIONS:\s*(\[[^\]]*\])/s);
    if (sugMatch) {
      try { suggestions = JSON.parse(sugMatch[1]); } catch {}
      answer = answer.replace(/SUGGESTIONS:\s*\[[^\]]*\]/s, '').trim();
    }

    const srcMatch = raw.match(/SOURCES:\s*\[([^\]]*)\]/);
    if (srcMatch) {
      const indices = srcMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      sourcedEventIds = indices.map(n => indexedIds[n - 1]).filter(Boolean);
      answer = answer.replace(/SOURCES:\s*\[[^\]]*\]/s, '').trim();
    }

    return { answer, grounded: true, suggestions, sourcedEventIds };
  } catch (err) {
    if (err.isQuotaError) return quotaFallback('QUOTA_EXHAUSTED');
    logger.error(`[GeminiService] chat() failed: ${err.message}`);
    return { answer: 'An unexpected error occurred. Please try again.', grounded: false, errorCode: 'UNKNOWN_ERROR', suggestions: [], sourcedEventIds: [] };
  }
}

async function* chatStream(question, recentAttacks, history = []) {
  if (!getModels()) {
    yield { type: 'error', errorCode: 'NO_API_KEY' };
    return;
  }

  const { context, indexedIds } = buildAttackContext(recentAttacks);
  const historyBlock = buildHistoryBlock(history);

  const prompt =
    `You are SENTINEL AI, a senior cybersecurity analyst embedded in the SENTINAL threat detection platform.\n` +
    PLATFORM_KNOWLEDGE + '\n' +
    `LIVE ATTACK TELEMETRY (last 24h):\n${context}\n` +
    historyBlock +
    `\nAnswer the analyst's question. Be direct and actionable.\n` +
    STEPS_FORMAT_INSTRUCTION + '\n' +
    `Do NOT fabricate events not in the data. Keep answer under 350 words. Plain text only.\n` +
    `\nAfter your full answer, on a NEW LINE write exactly:\n` +
    `SUGGESTIONS: ["follow-up question 1?", "follow-up question 2?", "follow-up question 3?"]\n` +
    `SOURCES: [list the index numbers from the telemetry you used, e.g. 1,3,7]\n` +
    `\nQuestion: ${question}`;

  try {
    let fullText = '';
    let metadataStarted = false;

    for await (const chunk of generateStreamWithFallback(prompt)) {
      fullText += chunk;
      if (!metadataStarted) {
        metadataStarted = /(?:^|\n)(?:SUGGESTIONS:|SOURCES:)/.test(fullText);
      }
      if (!metadataStarted) {
        yield { type: 'chunk', text: chunk };
      }
    }

    let suggestions = [];
    let sourcedEventIds = [];

    const sugMatch = fullText.match(/SUGGESTIONS:\s*(\[[^\]]*\])/s);
    if (sugMatch) {
      try { suggestions = JSON.parse(sugMatch[1]); } catch {}
    }
    const srcMatch = fullText.match(/SOURCES:\s*\[([^\]]*)\]/);
    if (srcMatch) {
      const indices = srcMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      sourcedEventIds = indices.map(n => indexedIds[n - 1]).filter(Boolean);
    }

    yield { type: 'done', suggestions, sourcedEventIds, grounded: true };
  } catch (err) {
    if (err.isQuotaError) {
      yield { type: 'error', errorCode: 'QUOTA_EXHAUSTED' };
    } else {
      logger.error(`[GeminiService] chatStream() failed: ${err.message}`);
      yield { type: 'error', errorCode: 'UNKNOWN_ERROR' };
    }
  }
}

async function generateReport(attack, reportType = 'technical') {
  const staticReport = {
    generated: false,
    reportType,
    executive_summary: `${attack.attackType?.toUpperCase() || 'UNKNOWN'} attack from ${attack.ip || 'unknown'} — severity: ${attack.severity}.`,
    technical_finding: attack.payload ? `Payload: ${String(attack.payload).slice(0, 200)}` : 'No payload captured.',
    likely_impact: attack.severity === 'critical' ? 'Potential breach or disruption.' : 'Limited impact if mitigated.',
    remediation_steps: [
      `Block IP: ${attack.ip || 'unknown'}`,
      'Review last 24h of requests from this IP',
      `Update WAF rules for ${attack.attackType || 'this'} patterns`,
      'Apply latest security patches',
    ],
    next_steps: 'Escalate if critical/high. Monitor for repeat attempts.',
    risk_level: attack.severity || 'unknown',
    generated_at: new Date().toISOString(),
  };

  if (!getModels()) return staticReport;

  const audienceInstructions = {
    executive: 'Write for a non-technical executive. Focus on business impact and strategic recommendations.',
    technical: 'Write for a security engineer. Include technical detail about the attack vector and precise remediation.',
    forensic:  'Write for a forensic investigator. Include IOCs, timeline reconstruction, and evidence preservation notes.',
  };

  const instruction = audienceInstructions[reportType] || audienceInstructions.technical;

  const prompt =
    `You are SENTINEL AI generating a formal incident report.\n\n` +
    `REPORT TYPE: ${reportType.toUpperCase()}\n` +
    `AUDIENCE INSTRUCTIONS: ${instruction}\n\n` +
    `ATTACK: id=${attack._id} type=${attack.attackType} severity=${attack.severity} ` +
    `status=${attack.status} ip=${attack.ip || 'unknown'} confidence=${attack.confidence != null ? Math.round(attack.confidence * 100) + '%' : '?'} ` +
    `ts=${attack.timestamp ? new Date(attack.timestamp).toISOString() : 'unknown'} ` +
    `payload=${String(attack.payload || 'none').slice(0, 200)}\n\n` +
    `Return ONLY a JSON object with keys: executive_summary, technical_finding, likely_impact, ` +
    `remediation_steps (array), next_steps, risk_level. No markdown, no extra text.`;

  try {
    const text = await generateWithFallback(prompt);
    if (!text) return staticReport;
    const parsed = safeParseJSON(text);
    if (!parsed) return staticReport;
    return { ...parsed, generated: true, reportType, generated_at: new Date().toISOString() };
  } catch (err) {
    if (err.isQuotaError) return staticReport;
    logger.error(`[GeminiService] generateReport() failed: ${err.message}`);
    return staticReport;
  }
}

async function correlate(attacks) {
  const byIp = {};
  const byType = {};
  attacks.forEach(a => {
    const ip   = a.ip || 'unknown';
    const type = a.attackType || 'unknown';
    if (!byIp[ip])     byIp[ip]     = [];
    if (!byType[type]) byType[type] = [];
    byIp[ip].push({ type, severity: a.severity, status: a.status, ts: a.timestamp, payload: String(a.payload || '').slice(0, 60) });
    byType[type].push(ip);
  });

  const topIps = Object.entries(byIp)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([ip, events]) => ({
      ip,
      count: events.length,
      types: [...new Set(events.map(e => e.type))],
      severities: [...new Set(events.map(e => e.severity))],
      statuses: [...new Set(events.map(e => e.status))],
      firstSeen: events.map(e => e.ts).filter(Boolean).sort()[0],
      lastSeen:  events.map(e => e.ts).filter(Boolean).sort().reverse()[0],
    }));

  const multiTypeIps = topIps.filter(x => x.types.length > 1);

  const clusterSummary = topIps.map(x =>
    `IP ${x.ip}: ${x.count} attacks, types=[${x.types.join(',')}], severity=[${x.severities.join(',')}], firstSeen=${x.firstSeen || 'unknown'}, lastSeen=${x.lastSeen || 'unknown'}`
  ).join('\n');

  const staticFallback = {
    campaigns: multiTypeIps.map(x => ({
      name: `Campaign from ${x.ip}`,
      sourceIps: [x.ip],
      attackTypes: x.types,
      severity: x.severities.includes('critical') ? 'critical' : x.severities.includes('high') ? 'high' : 'medium',
      eventCount: x.count,
      firstSeen: x.firstSeen,
      lastSeen: x.lastSeen,
      assessment: `Multi-vector attacker: ${x.types.join(', ')} from single IP.`,
    })),
    sharedInfrastructure: [],
    attackChains: [],
    riskScore: Math.min(100, multiTypeIps.length * 20 + topIps.length * 5),
    summary: `Analysed ${attacks.length} attacks from ${Object.keys(byIp).length} unique IPs. ${multiTypeIps.length} IPs performed multi-vector attacks.`,
    generated: false,
  };

  if (!getModels()) return { ...staticFallback, errorCode: 'NO_API_KEY' };

  const prompt =
    `You are SENTINEL AI performing threat intelligence correlation.\n\n` +
    `ATTACK CLUSTER SUMMARY (${attacks.length} events, ${Object.keys(byIp).length} unique IPs):\n` +
    `${clusterSummary}\n\n` +
    `Identify coordinated attack campaigns, shared infrastructure, and attack chains.\n\n` +
    `Return ONLY a JSON object:\n` +
    `{\n` +
    `  "campaigns": [{ "name": string, "sourceIps": string[], "attackTypes": string[], "severity": string, "eventCount": number, "firstSeen": string|null, "lastSeen": string|null, "assessment": string }],\n` +
    `  "sharedInfrastructure": [{ "ips": string[], "evidence": string }],\n` +
    `  "attackChains": [{ "sequence": string[], "description": string }],\n` +
    `  "riskScore": number (0-100),\n` +
    `  "summary": string\n` +
    `}\n\nNo markdown. No extra text. Only valid JSON.`;

  try {
    const text = await generateWithFallback(prompt);
    if (!text) return { ...staticFallback, errorCode: 'NO_API_KEY' };
    const parsed = safeParseJSON(text);
    if (!parsed) return staticFallback;
    return { ...parsed, generated: true };
  } catch (err) {
    if (err.isQuotaError) return { ...staticFallback, errorCode: 'QUOTA_EXHAUSTED' };
    logger.error(`[GeminiService] correlate() failed: ${err.message}`);
    return staticFallback;
  }
}

async function mutate(payload, attackType) {
  const staticMutations = [
    { variant: payload.replace(/'/g, '%27').replace(/"/g, '%22'), technique: 'URL Encoding', evades: 'Basic string matching WAF rules', risk: 'medium', evasionProbability: 0.55, category: 'encoding' },
    { variant: payload.split('').map((c, i) => i % 3 === 0 ? c.toUpperCase() : c.toLowerCase()).join(''), technique: 'Case Alternation', evades: 'Case-sensitive WAF signatures', risk: 'low', evasionProbability: 0.30, category: 'case' },
    { variant: payload.replace(/\s+/g, '/**/'), technique: 'Comment Injection', evades: 'Whitespace-based tokenisation rules', risk: 'high', evasionProbability: 0.72, category: 'comment' },
    { variant: [...payload].map(c => `&#${c.charCodeAt(0)};`).join(''), technique: 'HTML Entity Encoding', evades: 'Plain-text WAF rules, XSS filters', risk: 'high', evasionProbability: 0.68, category: 'encoding' },
    { variant: Buffer.from(payload).toString('base64'), technique: 'Base64 Encoding', evades: 'Payload content inspection', risk: 'medium', evasionProbability: 0.50, category: 'encoding' },
  ];

  if (!getModels()) return { original: payload, mutations: staticMutations, generated: false, errorCode: 'NO_API_KEY' };

  const prompt =
    `You are a senior red-team security researcher generating WAF evasion test cases.\n\n` +
    `ORIGINAL PAYLOAD (${attackType}): ${payload}\n\n` +
    `Generate exactly 5 evasion variants using different techniques.\n` +
    `Return ONLY a JSON object:\n` +
    `{ "mutations": [{ "variant": string, "technique": string, "evades": string, "risk": string, "evasionProbability": number, "category": string }] }\n` +
    `Exactly 5 items. No markdown. Valid JSON only.`;

  try {
    const text = await generateWithFallback(prompt);
    if (!text) return { original: payload, mutations: staticMutations, generated: false, errorCode: 'NO_API_KEY' };
    const parsed = safeParseJSON(text);
    if (!parsed || !Array.isArray(parsed.mutations)) return { original: payload, mutations: staticMutations, generated: false };
    return { original: payload, mutations: parsed.mutations, generated: true };
  } catch (err) {
    if (err.isQuotaError) return { original: payload, mutations: staticMutations, generated: false, errorCode: 'QUOTA_EXHAUSTED' };
    logger.error(`[GeminiService] mutate() failed: ${err.message}`);
    return { original: payload, mutations: staticMutations, generated: false };
  }
}

module.exports = { chat, chatStream, generateReport, correlate, mutate, resetModels };
