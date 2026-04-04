/**
 * geminiService.js — SENTINAL Gemini AI integration
 *
 * Free-tier model chain (April 2026):
 *   1. gemini-2.5-flash        — primary   — 15 RPM, 250 RPD
 *   2. gemini-2.5-flash-8b     — fallback  — higher RPM, smaller model
 *   3. gemini-2.5-flash-lite   — last resort — preview, most lenient quota
 *
 * Retired as of March/April 2026 (DO NOT USE):
 *   ✗ gemini-2.0-flash          — deprecated Feb 2026, retired Mar 3 2026
 *   ✗ gemini-2.0-flash-lite     — same retirement schedule
 *   ✗ gemini-1.5-flash          — fully discontinued, 404 on v1beta
 *   ✗ gemini-1.5-flash-latest   — same, -latest alias also returns 404
 *
 * Capabilities:
 *   1. chat()           — Security Co-Pilot Q&A grounded in live attack telemetry
 *   2. chatStream()     — Streaming version of chat()
 *   3. generateReport() — Structured incident report for a single attack
 *   4. correlate()      — Campaign correlation across up to 200 recent attacks
 *   5. mutate()         — Payload evasion variant generator
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

// ── Model chain ────────────────────────────────────────────────────────────────
// All 2.0-series and 1.5-series models are retired as of March/April 2026.
// Free-tier available models: 2.5-flash, 2.5-flash-8b, 2.5-flash-lite
const MODEL_CHAIN = [
  'gemini-2.5-flash',        // primary   — 15 RPM, 250 RPD
  'gemini-2.5-flash-8b',     // fallback  — higher RPM, lighter quality
  'gemini-2.5-flash-lite',   // last resort — preview, most lenient quota
];

let _genAI  = null;
let _models = null;

function getModels() {
  if (_models) return _models;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _genAI  = new GoogleGenerativeAI(key);
  _models = MODEL_CHAIN.map(name =>
    _genAI.getGenerativeModel({
      model: name,
      generationConfig: {
        temperature:     0.2,
        topP:            0.8,
        maxOutputTokens: 1024,
      },
    })
  );
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

// ── SENTINAL Platform Knowledge ─────────────────────────────────────────────
const PLATFORM_KNOWLEDGE = `You are embedded inside SENTINAL — a real-time threat detection and response platform.
You have full knowledge of every page and feature. Use this knowledge to give analysts
exact navigation steps whenever your answer involves doing something in the UI.

PLATFORM PAGES & FEATURES:

1. /dashboard        — Live KPIs: total attacks, blocked count, critical alerts, active services.
                       Attack type breakdown chart, severity distribution, recent activity feed.
2. /attacks          — Full table of all detected attack events from MongoDB.
                       Filter by type, severity, status, date range, IP.
                       Each row: 🔬 Forensics button (AI forensic report) and 📊 Report button.
3. /alerts           — System alerts with priority badges. Mark read individually or bulk-mark all.
4. /logs             — Raw request logs. Search by path or IP.
5. /pcap             — Upload .pcap/.pcapng for AI-powered packet analysis. Drag-and-drop upload zone.
6. /action-queue     — AI-suggested actions awaiting human approval.
                       Each card: ✅ Approve / ❌ Reject. "Approve All Low Risk" bulk button.
7. /audit            — Immutable audit trail: actor, action type, target, outcome.
8. /services         — Health status of all monitored upstream services. "+ Add Service" button.
9. /copilot          — THIS IS WHERE YOU LIVE. Streaming Q&A grounded in live MongoDB telemetry.
10. /correlation     — "Run Correlation" → Gemini analyses up to 200 recent attacks for campaigns.
11. /simulate        — Enter any payload → AI generates 5 WAF-bypass mutation variants.
12. /settings        — Detection thresholds, alert rules, API key management, AI feature toggles.

NAVIGATION: Sidebar always visible on the left. React Router SPA — no full page reloads.

GUIDELINES:
- If the analyst asks HOW to do something, give exact numbered STEPS using page names and button labels.
  Format:
  STEPS:
  1. Go to [Page Name] (/route)
  2. [Exact action with button/field name]
- Ground data answers in telemetry and tell analysts WHERE in the UI to act on it.
- Say "click the 🔬 Forensics button on the Attacks page" — not "view forensics".
- Blocking an IP → /action-queue. Investigating an event → /attacks Forensics/Report buttons.`;

// ── Core: generate with model fallback + one retry per model on 429 ──────────
async function generateWithFallback(request) {
  const models = getModels();
  if (!models) return null;

  for (let m = 0; m < models.length; m++) {
    const modelName = MODEL_CHAIN[m];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await models[m].generateContent(request);
        logger.info(`[GeminiService] ✓ ${modelName} responded (attempt ${attempt})`);
        return result.response.text().trim();
      } catch (err) {
        const msg   = err.message || '';
        const is429 = msg.includes('429');
        const is404 = msg.includes('404');

        if (is404) {
          logger.warn(`[GeminiService] 404: model ${modelName} not found — trying next model in chain.`);
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

// ── Core: streaming version ───────────────────────────────────────────────────
async function* generateStreamWithFallback(request) {
  const models = getModels();
  if (!models) return;

  for (let m = 0; m < models.length; m++) {
    const modelName = MODEL_CHAIN[m];
    try {
      const result = await models[m].generateContentStream(request);
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
      if (is404) {
        logger.warn(`[GeminiService] 404: model ${modelName} not found on stream — trying next model.`);
        continue;
      }
      if (is429) {
        logger.warn(`[GeminiService] ${modelName} rate-limited on stream — trying next model`);
        continue;
      }
      throw err;
    }
  }

  const quotaErr = new Error('QUOTA_EXHAUSTED');
  quotaErr.isQuotaError = true;
  throw quotaErr;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripFences(text) {
  return text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}
function safeParseJSON(text) {
  try { return JSON.parse(stripFences(text)); } catch { return null; }
}

function buildAttackContext(attacks) {
  if (!attacks || !attacks.length) return { context: 'No recent attack data available.', indexedIds: [] };
  const indexedIds = [];
  const lines = attacks.slice(0, 50).map((a, i) => {
    indexedIds.push(a._id ? String(a._id) : null);
    const payloadRaw = String(a.payload || '');
    const payload    = payloadRaw.slice(0, 200) + (payloadRaw.length > 200 ? '…' : '');
    const conf       = a.confidence != null ? Math.round(a.confidence * 100) + '%' : '?';
    const ts         = a.timestamp ? new Date(a.timestamp).toISOString() : 'unknown';
    return (
      `[${i + 1}] type=${a.attackType} | sev=${a.severity} | status=${a.status} | ` +
      `ip=${a.ip || 'unknown'} | conf=${conf} | detectedBy=${a.detectedBy || 'unknown'} | ` +
      `payload="${payload}" | ts=${ts} | id=${a._id || 'unknown'}`
    );
  });
  return { context: lines.join('\n'), indexedIds };
}

function quotaFallback(errorCode) {
  const answer = errorCode === 'QUOTA_EXHAUSTED'
    ? 'The AI Co-Pilot has reached its free-tier API quota for today. Quota resets daily at midnight Pacific time. To remove this limit, enable billing at https://ai.google.dev.'
    : 'Gemini API key is not configured. Add GEMINI_API_KEY to your .env file.';
  return { answer, grounded: false, errorCode, suggestions: [], sourcedEventIds: [] };
}

function buildChatRequest(question, context, history) {
  const isNavQuestion = /how\s+do|where\s+(can|do|is)|show\s+me|go\s+to|navigate|find\s+the|which\s+page|which\s+button|how\s+to\s+(block|view|approve|reject|upload|filter|export|see)/i.test(question);

  const systemInstruction = isNavQuestion
    ? `You are SENTINEL AI, a senior cybersecurity analyst and platform guide embedded in the SENTINAL threat detection platform.\n${PLATFORM_KNOWLEDGE}\nBe direct and actionable. If the question involves a UI action, output a STEPS: block with exact page names and button labels.`
    : `You are SENTINEL AI, a senior cybersecurity analyst embedded in the SENTINAL threat detection platform. You have access to live attack telemetry. Analyse the data, identify patterns, and give precise, actionable security insights. Do not make up events not in the telemetry. Do not mention UI navigation unless directly asked.`;

  const isComplexQuestion = /correlat|forensic|analys|explain|why|how does|pattern|campaign|chain|what is|describe|summar/i.test(question);
  const wordLimit = isComplexQuestion ? 600 : 300;

  const historyTurns = (history || []).slice(-6).map(h => ({
    role:  h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }],
  }));

  const userMessage =
    `LIVE ATTACK TELEMETRY (last 50 events, most recent first):\n${context}\n\n` +
    `Answer the analyst's question. Be direct and actionable. Keep answer under ${wordLimit} words.\n` +
    `Do NOT fabricate events not in the telemetry above. Plain text only — no markdown headers.\n` +
    (isNavQuestion
      ? `If the answer involves a UI action, include a STEPS: block with exact page names and button labels.\n`
      : '') +
    `\nAfter your full answer, on a NEW LINE write EXACTLY (no extra text before or after):\n` +
    `SUGGESTIONS: ["follow-up question 1?", "follow-up question 2?", "follow-up question 3?"]\n` +
    `SOURCES: [index numbers from the telemetry you used, e.g. 1,3,7]\n` +
    `\nQuestion: ${question}`;

  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [
      ...historyTurns,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
  };
}

function extractMetadata(raw, indexedIds) {
  const metaIdx = raw.search(/(?:^|\n)(?:SUGGESTIONS:|SOURCES:)/);
  const answer  = metaIdx !== -1 ? raw.slice(0, metaIdx).trim() : raw.trim();
  const meta    = metaIdx !== -1 ? raw.slice(metaIdx) : '';

  let suggestions     = [];
  let sourcedEventIds = [];

  const sugMatch = meta.match(/SUGGESTIONS:\s*(\[[^\]]*\])/s);
  if (sugMatch) {
    try { suggestions = JSON.parse(sugMatch[1]); } catch { suggestions = []; }
  }

  const srcMatch = meta.match(/SOURCES:\s*\[([^\]]*)\]/);
  if (srcMatch) {
    const indices = srcMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    sourcedEventIds = indices.map(n => indexedIds[n - 1]).filter(Boolean);
  }

  return { answer, suggestions, sourcedEventIds };
}

// ── 1. Security Co-Pilot Chat ─────────────────────────────────────────────────
async function chat(question, recentAttacks, history = []) {
  if (!getModels()) return quotaFallback('NO_API_KEY');

  const { context, indexedIds } = buildAttackContext(recentAttacks);
  const request = buildChatRequest(question, context, history);

  try {
    const raw = await generateWithFallback(request);
    if (raw === null) return quotaFallback('NO_API_KEY');

    const { answer, suggestions, sourcedEventIds } = extractMetadata(raw, indexedIds);

    logger.info(`[GeminiService] chat() ✓ — sources=${sourcedEventIds.length} suggestions=${suggestions.length}`);
    return { answer, grounded: true, suggestions, sourcedEventIds };
  } catch (err) {
    if (err.isQuotaError) return quotaFallback('QUOTA_EXHAUSTED');
    logger.error(`[GeminiService] chat() failed: ${err.message}`);
    return { answer: 'An unexpected error occurred. Please try again.', grounded: false, errorCode: 'UNKNOWN_ERROR', suggestions: [], sourcedEventIds: [] };
  }
}

// ── 2. Streaming chat ─────────────────────────────────────────────────────────
async function* chatStream(question, recentAttacks, history = []) {
  if (!getModels()) {
    yield { type: 'error', errorCode: 'NO_API_KEY' };
    return;
  }

  const { context, indexedIds } = buildAttackContext(recentAttacks);
  const request = buildChatRequest(question, context, history);

  try {
    let fullText        = '';
    let metadataStarted = false;

    for await (const chunk of generateStreamWithFallback(request)) {
      fullText += chunk;

      if (!metadataStarted) {
        metadataStarted = /(?:^|\n)(?:SUGGESTIONS:|SOURCES:)/.test(fullText);
      }

      if (!metadataStarted) {
        yield { type: 'chunk', text: chunk };
      }
    }

    const { answer: _a, suggestions, sourcedEventIds } = extractMetadata(fullText, indexedIds);
    logger.info(`[GeminiService] chatStream() ✓ — sources=${sourcedEventIds.length} suggestions=${suggestions.length}`);
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

// ── 3. Incident Report Generator ─────────────────────────────────────────────
async function generateReport(attack, reportType = 'technical') {
  const staticReport = {
    generated: false,
    reportType,
    executive_summary: `${attack.attackType?.toUpperCase() || 'UNKNOWN'} attack from ${attack.ip || 'unknown'} — severity: ${attack.severity}.`,
    technical_finding: attack.payload ? `Payload: ${String(attack.payload).slice(0, 300)}` : 'No payload captured.',
    likely_impact: attack.severity === 'critical' ? 'Potential breach or service disruption.' : 'Limited impact if mitigated promptly.',
    remediation_steps: [
      `Block source IP: ${attack.ip || 'unknown'} via /action-queue`,
      'Review all requests from this IP in the last 24h on the Logs page',
      `Update WAF rules to cover ${attack.attackType || 'this'} patterns`,
      'Apply latest security patches to affected service',
    ],
    next_steps: 'Escalate if critical/high severity. Monitor for repeat attempts from same IP range.',
    risk_level: attack.severity || 'unknown',
    generated_at: new Date().toISOString(),
  };

  if (!getModels()) return staticReport;

  const audienceInstructions = {
    executive: 'Write for a non-technical executive audience. Focus on business impact, risk, and strategic recommendations. Avoid jargon. Keep each field under 3 sentences.',
    technical: 'Write for a security engineer. Include technical detail about the attack vector, affected components, CVEs if applicable, and precise step-by-step remediation.',
    forensic:  'Write for a forensic investigator. Include all IOCs (IP, payload hashes, patterns), timeline reconstruction, evidence preservation notes, and chain-of-custody considerations.',
  };

  const instruction = audienceInstructions[reportType] || audienceInstructions.technical;
  const payloadFull = String(attack.payload || 'none').slice(0, 300);

  const prompt =
    `You are SENTINEL AI generating a formal security incident report.\n\n` +
    `REPORT TYPE: ${reportType.toUpperCase()}\n` +
    `AUDIENCE: ${instruction}\n\n` +
    `ATTACK DETAILS:\n` +
    `  id:          ${attack._id}\n` +
    `  type:        ${attack.attackType}\n` +
    `  severity:    ${attack.severity}\n` +
    `  status:      ${attack.status}\n` +
    `  source IP:   ${attack.ip || 'unknown'}\n` +
    `  confidence:  ${attack.confidence != null ? Math.round(attack.confidence * 100) + '%' : 'unknown'}\n` +
    `  timestamp:   ${attack.timestamp ? new Date(attack.timestamp).toISOString() : 'unknown'}\n` +
    `  detectedBy:  ${attack.detectedBy || 'unknown'}\n` +
    `  payload:     ${payloadFull}\n\n` +
    `Return ONLY a valid JSON object with EXACTLY these keys:\n` +
    `  executive_summary  (string)\n` +
    `  technical_finding  (string)\n` +
    `  likely_impact      (string)\n` +
    `  remediation_steps  (array of strings)\n` +
    `  next_steps         (string)\n` +
    `  risk_level         (string: low|medium|high|critical)\n` +
    `No markdown. No extra text. Only valid JSON.`;

  try {
    const text = await generateWithFallback(prompt);
    if (!text) return staticReport;
    const parsed = safeParseJSON(text);
    if (!parsed) {
      logger.warn('[GeminiService] generateReport() — JSON parse failed, using static report');
      return staticReport;
    }
    logger.info(`[GeminiService] generateReport() ✓ (type=${reportType})`);
    return { ...parsed, generated: true, reportType, generated_at: new Date().toISOString() };
  } catch (err) {
    if (err.isQuotaError) return staticReport;
    logger.error(`[GeminiService] generateReport() failed: ${err.message}`);
    return staticReport;
  }
}

// ── 4. Attack Correlation Engine ──────────────────────────────────────────────
async function correlate(attacks) {
  const byIp   = {};
  const byType = {};

  attacks.forEach(a => {
    const ip   = a.ip   || 'unknown';
    const type = a.attackType || 'unknown';
    if (!byIp[ip])     byIp[ip]     = [];
    if (!byType[type]) byType[type] = [];
    byIp[ip].push({
      type,
      severity: a.severity,
      status:   a.status,
      ts:       a.timestamp,
      payload:  String(a.payload || '').slice(0, 80),
    });
    byType[type].push(ip);
  });

  const topIps = Object.entries(byIp)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([ip, events]) => ({
      ip,
      count:      events.length,
      types:      [...new Set(events.map(e => e.type))],
      severities: [...new Set(events.map(e => e.severity))],
      statuses:   [...new Set(events.map(e => e.status))],
      firstSeen:  events.map(e => e.ts).filter(Boolean).sort()[0],
      lastSeen:   events.map(e => e.ts).filter(Boolean).sort().reverse()[0],
    }));

  const multiTypeIps = topIps.filter(x => x.types.length > 1);

  const clusterSummary = topIps.map(x =>
    `IP ${x.ip}: ${x.count} attacks | types=[${x.types.join(',')}] | severity=[${x.severities.join(',')}] | status=[${x.statuses.join(',')}] | firstSeen=${x.firstSeen || 'unknown'} | lastSeen=${x.lastSeen || 'unknown'}`
  ).join('\n');

  const staticFallback = {
    campaigns: multiTypeIps.map(x => ({
      name:        `Campaign from ${x.ip}`,
      sourceIps:   [x.ip],
      attackTypes: x.types,
      severity:    x.severities.includes('critical') ? 'critical' : x.severities.includes('high') ? 'high' : 'medium',
      eventCount:  x.count,
      firstSeen:   x.firstSeen || null,
      lastSeen:    x.lastSeen  || null,
      assessment:  `Multi-vector attacker using ${x.types.join(', ')} from a single IP.`,
    })),
    sharedInfrastructure: [],
    attackChains:         [],
    riskScore: Math.min(100, multiTypeIps.length * 20 + topIps.length * 5),
    summary:   `Analysed ${attacks.length} attacks from ${Object.keys(byIp).length} unique IPs. ${multiTypeIps.length} IPs performed multi-vector attacks.`,
    generated: false,
  };

  if (!getModels()) return { ...staticFallback, errorCode: 'NO_API_KEY' };

  const prompt =
    `You are SENTINEL AI performing threat intelligence correlation on real attack data.\n\n` +
    `ATTACK CLUSTER SUMMARY (${attacks.length} total events, ${Object.keys(byIp).length} unique source IPs):\n` +
    `${clusterSummary}\n\n` +
    `Analyse this data and identify:\n` +
    `1. Coordinated attack campaigns (IPs or groups targeting similar endpoints with related techniques)\n` +
    `2. Shared attacker infrastructure (multiple IPs with overlapping attack patterns suggesting same actor)\n` +
    `3. Multi-stage attack chains (sequences like recon → exploitation → persistence)\n\n` +
    `Return ONLY a JSON object with EXACTLY these fields:\n` +
    `{\n` +
    `  "campaigns": [{ "name": string, "sourceIps": string[], "attackTypes": string[], "severity": string, "eventCount": number, "firstSeen": string|null, "lastSeen": string|null, "assessment": string }],\n` +
    `  "sharedInfrastructure": [{ "ips": string[], "evidence": string }],\n` +
    `  "attackChains": [{ "sequence": string[], "description": string }],\n` +
    `  "riskScore": number (0-100, reflecting overall threat severity),\n` +
    `  "summary": string (2-3 sentence executive overview)\n` +
    `}\n\nNo markdown. No extra text. Only valid JSON.`;

  try {
    const text = await generateWithFallback(prompt);
    if (!text) return { ...staticFallback, errorCode: 'NO_API_KEY' };
    const parsed = safeParseJSON(text);
    if (!parsed) {
      logger.warn('[GeminiService] correlate() — JSON parse failed, returning static fallback');
      return staticFallback;
    }
    logger.info(`[GeminiService] correlate() ✓ — campaigns=${parsed.campaigns?.length || 0}, riskScore=${parsed.riskScore}`);
    return { ...parsed, generated: true };
  } catch (err) {
    if (err.isQuotaError) return { ...staticFallback, errorCode: 'QUOTA_EXHAUSTED' };
    logger.error(`[GeminiService] correlate() failed: ${err.message}`);
    return staticFallback;
  }
}

// ── 5. Payload Mutation Generator ─────────────────────────────────────────────
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
    `You are a senior red-team security researcher generating WAF evasion test cases for internal security testing.\n\n` +
    `ORIGINAL PAYLOAD (attack type: ${attackType}):\n${payload}\n\n` +
    `Generate exactly 5 distinct evasion variants of this payload, each using a different technique.\n` +
    `Techniques to consider: URL encoding, double URL encoding, HTML entity encoding, Unicode escape sequences,\n` +
    `SQL comment injection (/**/, --), case alternation, whitespace manipulation, base64 wrapping,\n` +
    `hex encoding, null byte injection (%00), CDATA wrapping (for XML/XXE).\n\n` +
    `For each variant explain SPECIFICALLY which WAF rule or filter class it bypasses and why.\n\n` +
    `Return ONLY a JSON object:\n` +
    `{\n` +
    `  "mutations": [\n` +
    `    {\n` +
    `      "variant":           "the mutated payload string",\n` +
    `      "technique":         "technique name",\n` +
    `      "evades":            "specific WAF rule/filter class this bypasses and why",\n` +
    `      "risk":              "low|medium|high|critical",\n` +
    `      "evasionProbability": 0.0-1.0,\n` +
    `      "category":          "encoding|whitespace|case|comment|null-byte|unicode"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\nExactly 5 items. No markdown. Valid JSON only.`;

  try {
    const text = await generateWithFallback(prompt);
    if (!text) return { original: payload, mutations: staticMutations, generated: false, errorCode: 'NO_API_KEY' };
    const parsed = safeParseJSON(text);
    if (!parsed || !Array.isArray(parsed.mutations) || parsed.mutations.length === 0) {
      logger.warn('[GeminiService] mutate() — JSON parse failed or empty, using static mutations');
      return { original: payload, mutations: staticMutations, generated: false };
    }
    logger.info(`[GeminiService] mutate() ✓ — ${parsed.mutations.length} variants generated`);
    return { original: payload, mutations: parsed.mutations, generated: true };
  } catch (err) {
    if (err.isQuotaError) return { original: payload, mutations: staticMutations, generated: false, errorCode: 'QUOTA_EXHAUSTED' };
    logger.error(`[GeminiService] mutate() failed: ${err.message}`);
    return { original: payload, mutations: staticMutations, generated: false };
  }
}

module.exports = { chat, chatStream, generateReport, correlate, mutate, resetModels };
