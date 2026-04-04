import { useState, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { geminiMutate } from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/* ─── IP Pool — 40 diverse IPs; blocked ones are never reused this session ── */
const IP_POOL = [
  '203.0.113.10','203.0.113.11','203.0.113.12','203.0.113.13','203.0.113.14',
  '198.51.100.5','198.51.100.20','198.51.100.77','198.51.100.88','198.51.100.99',
  '185.220.101.1','185.220.101.2','185.220.101.3','185.220.101.45','185.220.101.67',
  '91.108.4.10','91.108.4.20','91.108.4.30','91.108.4.40','91.108.4.50',
  '45.33.32.156','45.33.32.200','45.33.32.201','45.33.32.202','45.33.32.210',
  '104.21.10.1','104.21.10.2','104.21.10.3','104.21.10.4','104.21.10.5',
  '77.88.55.60','77.88.55.70','77.88.55.80','77.88.55.90','77.88.55.100',
  '2.56.188.1','2.56.188.2','2.56.188.3','2.56.188.4','2.56.188.5',
];
const usedIPs = new Set();
function getFreshIP() {
  const available = IP_POOL.filter(ip => !usedIPs.has(ip));
  if (available.length === 0) usedIPs.clear();
  const pool = available.length ? available : IP_POOL;
  const ip = pool[Math.floor(Math.random() * pool.length)];
  usedIPs.add(ip);
  return ip;
}

/* ─── Attack Definitions ─────────────────────────────────────────────────── */
const ATTACKS = [
  {
    id: 'sqli', label: 'SQL Injection', icon: '💉', color: '#ef4444',
    severity: 'high', confidence: 0.94,
    description: 'Classic login bypass via boolean-based SQLi',
    targetUrl: '/login', method: 'POST',
    payloadPreview: "username: admin' OR '1'='1' --",
    detectionMethod: 'Pattern + ML',
    expectedNexus: 'rate_limit_ip',
    makeBody: (ip) => ({
      ip, attackType: 'sqli', severity: 'high', confidence: 0.94,
      status: 'successful', method: 'POST', url: '/login',
      payload: { username: "admin' OR '1'='1' --", password: 'anything' },
    }),
  },
  {
    id: 'xss', label: 'XSS Attack', icon: '⚡', color: '#f97316',
    severity: 'medium', confidence: 0.88,
    description: 'Reflected XSS via search query parameter',
    targetUrl: '/search?q=', method: 'GET',
    payloadPreview: '<script>alert(document.cookie)</script>',
    detectionMethod: 'Pattern + ML',
    expectedNexus: 'rate_limit_ip',
    makeBody: (ip) => ({
      ip, attackType: 'xss', severity: 'medium', confidence: 0.88,
      status: 'successful', method: 'GET',
      url: '/search?q=<script>alert(document.cookie)</script>',
    }),
  },
  {
    id: 'traversal', label: 'Path Traversal', icon: '📁', color: '#eab308',
    severity: 'high', confidence: 0.91,
    description: 'Directory traversal to /etc/passwd',
    targetUrl: '/file?name=', method: 'GET',
    payloadPreview: '/../../../etc/passwd',
    detectionMethod: 'Pattern matching',
    expectedNexus: 'rate_limit_ip',
    makeBody: (ip) => ({
      ip, attackType: 'traversal', severity: 'high', confidence: 0.91,
      status: 'successful', method: 'GET', url: '/file?name=/../../../etc/passwd',
    }),
  },
  {
    id: 'cmdinject', label: 'Command Injection', icon: '💻', color: '#7c3aed',
    severity: 'critical', confidence: 0.96,
    description: 'OS command injection via search endpoint',
    targetUrl: '/search?q=', method: 'GET',
    payloadPreview: 'hello; cat /etc/shadow',
    detectionMethod: 'Pattern + ML',
    expectedNexus: 'permanent_ban → Action Queue',
    makeBody: (ip) => ({
      ip, attackType: 'command_injection', severity: 'critical', confidence: 0.96,
      status: 'successful', method: 'GET', url: '/search?q=hello; cat /etc/shadow',
    }),
  },
  {
    id: 'bruteforce', label: 'Brute Force', icon: '🔨', color: '#ef4444',
    severity: 'critical', confidence: 0.97,
    description: 'Credential brute-force — triggers Nexus directly',
    targetUrl: '/api/nexus/trigger', method: 'POST',
    payloadPreview: 'attackType: brute_force, confidence: 0.97',
    detectionMethod: 'Rate analysis (Nexus direct)',
    expectedNexus: 'permanent_ban → Action Queue',
    makeBody: (ip) => ({
      ip, attackType: 'brute_force', severity: 'critical', confidence: 0.97, status: 'successful',
    }),
  },
  {
    id: 'ssrf', label: 'SSRF', icon: '🌐', color: '#06b6d4',
    severity: 'high', confidence: 0.89,
    description: 'Server-Side Request Forgery to AWS metadata endpoint',
    targetUrl: '/proxy?url=', method: 'GET',
    payloadPreview: 'http://169.254.169.254/latest/meta-data/',
    detectionMethod: 'Pattern matching',
    expectedNexus: 'rate_limit_ip',
    makeBody: (ip) => ({
      ip, attackType: 'ssrf', severity: 'high', confidence: 0.89,
      status: 'successful', method: 'GET',
      url: '/proxy?url=http://169.254.169.254/latest/meta-data/',
    }),
  },
  {
    id: 'xxe', label: 'XXE Injection', icon: '📜', color: '#ec4899',
    severity: 'high', confidence: 0.87,
    description: 'XML External Entity injection via /api/parse',
    targetUrl: '/api/parse', method: 'POST',
    payloadPreview: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
    detectionMethod: 'XML inspection',
    expectedNexus: 'rate_limit_ip',
    makeBody: (ip) => ({
      ip, attackType: 'xxe', severity: 'high', confidence: 0.87,
      status: 'successful', method: 'POST', url: '/api/parse',
    }),
  },
  {
    id: 'lfi', label: 'LFI / RFI', icon: '📂', color: '#84cc16',
    severity: 'high', confidence: 0.90,
    description: 'Local file inclusion via page parameter',
    targetUrl: '/page?file=', method: 'GET',
    payloadPreview: '../../../../etc/passwd%00',
    detectionMethod: 'Pattern matching',
    expectedNexus: 'rate_limit_ip',
    makeBody: (ip) => ({
      ip, attackType: 'lfi_rfi', severity: 'high', confidence: 0.90,
      status: 'successful', method: 'GET', url: '/page?file=../../../../etc/passwd%00',
    }),
  },
  {
    id: 'hpp', label: 'HTTP Param Pollution', icon: '🔀', color: '#a78bfa',
    severity: 'medium', confidence: 0.78,
    description: 'Duplicate parameters to bypass WAF rules',
    targetUrl: '/search', method: 'GET',
    payloadPreview: '?q=legit&q=<script>alert(1)</script>',
    detectionMethod: 'Parameter analysis',
    expectedNexus: 'flag_for_review',
    makeBody: (ip) => ({
      ip, attackType: 'hpp', severity: 'medium', confidence: 0.78,
      status: 'successful', method: 'GET',
      url: '/search?q=legit&q=<script>alert(1)</script>',
    }),
  },
];

/* ─── Scenario Packs ──────────────────────────────────────────────────────── */
const SCENARIOS = [
  {
    id: 'apt', label: '🕵️ APT Simulation', color: '#ef4444',
    description: 'Advanced Persistent Threat: recon → exploitation → persistence attempt',
    attacks: ['traversal', 'sqli', 'lfi', 'cmdinject'],
    delays: [0, 900, 1800, 2700],
  },
  {
    id: 'recon', label: '🔍 Recon Sweep', color: '#06b6d4',
    description: 'Attacker probing for vulnerabilities across multiple vectors',
    attacks: ['traversal', 'lfi', 'ssrf', 'xxe', 'hpp'],
    delays: [0, 700, 1400, 2100, 2800],
  },
  {
    id: 'credential', label: '🔐 Credential Stuffing', color: '#f97316',
    description: 'Automated credential attack followed by brute force escalation',
    attacks: ['sqli', 'sqli', 'sqli', 'bruteforce'],
    delays: [0, 500, 1000, 1800],
    sameIP: true,
  },
  {
    id: 'fullwave', label: '🚨 Full Attack Wave', color: '#7c3aed',
    description: 'All 9 attack types fired sequentially — maximum coverage test',
    attacks: ATTACKS.map(a => a.id),
    delays: ATTACKS.map((_, i) => i * 900),
  },
];

const SEV_COLOR = {
  low: '#22c55e', medium: '#f97316', high: '#ef4444', critical: '#dc2626',
};
const ATTACK_TYPE_OPTIONS = [
  'sqli','xss','traversal','command_injection','ssrf','lfi_rfi',
  'brute_force','xxe','hpp','unknown',
];
const PIPELINE_LABELS = ['📤 Sent', '🔍 Detected', '🤖 Nexus', '✅ Done'];

/* ══════════════════════════════════════════════════════════════════════════ */
export default function SimulatePage() {

  /* ── State ── */
  const [firing,         setFiring]        = useState({});
  const [attackLog,      setAttackLog]     = useState([]);
  const [liveEvents,     setLiveEvents]    = useState([]);
  const [activeTab,      setActiveTab]     = useState('attacks');
  const [scenarioActive, setScenarioActive]= useState(null);
  const ipPoolRemaining = IP_POOL.length - usedIPs.size;

  // Custom builder
  const [custom, setCustom] = useState({
    ip: '', attackType: 'sqli', severity: 'high', confidence: 0.90,
    method: 'POST', url: '/login',
  });

  // Mutator
  const [mutPayload,  setMutPayload]  = useState('');
  const [mutType,     setMutType]     = useState('sqli');
  const [mutLoading,  setMutLoading]  = useState(false);
  const [mutResult,   setMutResult]   = useState(null);
  const [mutError,    setMutError]    = useState(null);
  const [copiedIdx,   setCopiedIdx]   = useState(null);

  const logEndRef = useRef(null);

  /* ── Socket Listeners ─────────────────────────────────────────────────── */
  useSocket('attack:new', useCallback((payload) => {
    const d = payload?.data ?? payload;
    setLiveEvents(prev => [{
      id:         d._id || d.id || Date.now(),
      type:       d.attackType || 'unknown',
      ip:         d.ip || '—',
      severity:   d.severity || 'low',
      confidence: d.confidence ? `${(d.confidence * 100).toFixed(0)}%` : '—',
      time:       new Date().toLocaleTimeString(),
      kind:       'attack',
    }, ...prev].slice(0, 40));

    // Advance pipeline: step 1 = Detected
    setAttackLog(prev => prev.map(l =>
      l.ip === (d.ip || '') && l.step < 1
        ? { ...l, step: 1 }
        : l
    ));
  }, []));

  useSocket('queue:update', useCallback((payload) => {
    const d = payload?.data ?? payload;
    setLiveEvents(prev => [{
      id:       d.id || Date.now(),
      type:     `🔒 ${d.action || 'action queued'}`,
      ip:       d.ip || '—',
      severity: 'critical',
      confidence: '—',
      time:     new Date().toLocaleTimeString(),
      kind:     'block',
    }, ...prev].slice(0, 40));

    setAttackLog(prev => prev.map(l =>
      l.ip === (d.ip || '')
        ? { ...l, step: 3, nexusAction: d.action }
        : l
    ));
  }, []));

  /* ── Fire a single attack ─────────────────────────────────────────────── */
  const fire = async (attackDef, overrideIP = null) => {
    const ip = overrideIP || getFreshIP();
    setFiring(f => ({ ...f, [attackDef.id]: true }));

    const logEntry = {
      id:              Date.now() + Math.random(),
      label:           attackDef.label,
      icon:            attackDef.icon,
      color:           attackDef.color,
      ip,
      targetUrl:       attackDef.targetUrl,
      payloadPreview:  attackDef.payloadPreview,
      severity:        attackDef.severity,
      confidence:      attackDef.confidence,
      detectionMethod: attackDef.detectionMethod,
      expectedNexus:   attackDef.expectedNexus,
      time:            new Date().toLocaleTimeString(),
      status:          'pending',
      step:            0,
      nexusAction:     null,
      geoIntel:        null,
      detail:          null,
    };
    setAttackLog(prev => [logEntry, ...prev].slice(0, 50));

    // Fetch geo intel (non-blocking, best-effort)
    fetchGeoIntel(ip, logEntry.id);

    try {
      const res  = await fetch(`${API}/api/nexus/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(attackDef.makeBody(ip)),
      });
      const data = await res.json();
      const ok   = res.ok || data.success;

      setAttackLog(prev => prev.map(l => l.id === logEntry.id
        ? { ...l, status: ok ? 'ok' : 'error', step: ok ? 1 : 0,
            detail: ok ? null : `❌ ${data.message || 'Request failed'}` }
        : l
      ));

      if (ok) {
        setTimeout(() => setAttackLog(prev => prev.map(l =>
          l.id === logEntry.id ? { ...l, step: 2 } : l
        )), 1200);
        setTimeout(() => setAttackLog(prev => prev.map(l =>
          l.id === logEntry.id && l.step < 3 ? { ...l, step: 3 } : l
        )), 2600);
      }
    } catch (err) {
      setAttackLog(prev => prev.map(l => l.id === logEntry.id
        ? { ...l, status: 'error', detail: `❌ ${err.message || 'Network error'}` }
        : l
      ));
    } finally {
      setFiring(f => ({ ...f, [attackDef.id]: false }));
    }
  };

  /* ── Fetch geo-intel for the fired IP ──────────────────────────────────── */
  const fetchGeoIntel = async (ip, logId) => {
    try {
      const res  = await fetch(`${API}/api/geo/ip/${encodeURIComponent(ip)}`);
      if (!res.ok) return;
      const data = await res.json();
      const entry = data?.data ?? data;
      setAttackLog(prev => prev.map(l =>
        l.id === logId ? { ...l, geoIntel: entry } : l
      ));
    } catch { /* silent — geo is enrichment, not critical */ }
  };

  /* ── Fire a scenario ──────────────────────────────────────────────────── */
  const fireScenario = async (scenario) => {
    setScenarioActive(scenario.id);
    const scenarioIP = scenario.sameIP ? getFreshIP() : null;
    for (let i = 0; i < scenario.attacks.length; i++) {
      const def = ATTACKS.find(a => a.id === scenario.attacks[i]);
      if (!def) continue;
      const delay = i === 0 ? 0 : scenario.delays[i] - scenario.delays[i - 1];
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      fire(def, scenarioIP);
    }
    const totalDuration = scenario.delays[scenario.attacks.length - 1] + 4000;
    setTimeout(() => setScenarioActive(null), totalDuration);
  };

  /* ── Fire custom attack ───────────────────────────────────────────────── */
  const fireCustom = () => {
    const ip = custom.ip || getFreshIP();
    fire({
      id:              `custom_${Date.now()}`,
      label:           `Custom: ${custom.attackType}`,
      icon:            '🔧',
      color:           '#a78bfa',
      severity:        custom.severity,
      confidence:      parseFloat(custom.confidence),
      description:     'Custom attack payload',
      targetUrl:       custom.url,
      payloadPreview:  `${custom.method} ${custom.url}`,
      detectionMethod: 'Custom / Direct',
      expectedNexus:   'Depends on severity',
      makeBody:        () => ({
        ip,
        attackType:  custom.attackType,
        severity:    custom.severity,
        confidence:  parseFloat(custom.confidence),
        status:      'successful',
        method:      custom.method,
        url:         custom.url,
      }),
    }, ip);
  };

  /* ── Gemini mutation ──────────────────────────────────────────────────── */
  const runMutation = async () => {
    if (!mutPayload.trim()) return;
    setMutLoading(true); setMutError(null); setMutResult(null);
    try {
      const data = await geminiMutate(mutPayload.trim(), mutType);
      setMutResult(data);
    } catch (err) {
      setMutError(err?.message || 'Mutation failed.');
    } finally {
      setMutLoading(false);
    }
  };

  const copyVariant = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {}
  };

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const clearLog    = () => setAttackLog([]);
  const clearEvents = () => setLiveEvents([]);

  /* ══════════════════════════════════════════════════════════════════════ */
  /* RENDER                                                                */
  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={S.page}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
              <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
              <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
              <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
              <path d="M15.5 9H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5S16.33 9 15.5 9z"/>
              <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
              <path d="M8.5 15H10v-1.5c0-.83-.67-1.5-1.5-1.5S7 12.67 7 13.5 7.67 15 8.5 15z"/>
            </svg>
            Attack Simulator
          </h1>
          <p style={S.subtitle}>
            Fire real attack payloads against SENTINAL. Each attack uses a <strong>fresh rotating IP</strong> —
            blocked IPs are never reused. Observe live detection in the feed →
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={S.liveBadge}>● LIVE</span>
          <span style={S.ipBadge}>🔄 {ipPoolRemaining} IPs remaining</span>
        </div>
      </div>

      {/* ── Main Layout ─────────────────────────────────────────────── */}
      <div style={S.layout}>

        {/* ════════════ LEFT PANEL ════════════ */}
        <div style={S.leftPanel}>

          {/* Tab Bar */}
          <div style={S.tabBar}>
            {[
              ['attacks',   '⚔️ Attacks'],
              ['scenarios', '🎬 Scenarios'],
              ['custom',    '🔧 Custom'],
              ['mutate',    '🧬 Mutator'],
            ].map(([id, label]) => (
              <button key={id} style={{ ...S.tab, ...(activeTab === id ? S.tabActive : {}) }}
                onClick={() => setActiveTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── TAB: ATTACK CARDS ──────────────────────────────────── */}
          {activeTab === 'attacks' && (
            <div style={S.attackGrid}>
              {ATTACKS.map(atk => (
                <button
                  key={atk.id}
                  onClick={() => fire(atk)}
                  disabled={!!firing[atk.id] || !!scenarioActive}
                  style={{
                    ...S.attackCard,
                    borderColor: atk.color,
                    opacity: (firing[atk.id] || scenarioActive) ? 0.55 : 1,
                    cursor: (firing[atk.id] || scenarioActive) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={S.cardTop}>
                    <span style={{ fontSize: '1.25rem' }}>{atk.icon}</span>
                    <span style={{ ...S.sevBadge, background: SEV_COLOR[atk.severity] + '22', color: SEV_COLOR[atk.severity] }}>
                      {atk.severity}
                    </span>
                    <span style={S.confBadge}>🎯 {(atk.confidence * 100).toFixed(0)}%</span>
                    {firing[atk.id] && <span style={S.firingDot} />}
                  </div>
                  <div style={{ ...S.cardLabel, color: atk.color }}>{atk.label}</div>
                  <div style={S.cardDesc}>{atk.description}</div>
                  <div style={S.cardMeta}>
                    <span style={S.metaTag}>📍 {atk.targetUrl}</span>
                    <span style={S.metaTag}>🔎 {atk.detectionMethod}</span>
                  </div>
                  <code style={S.payloadPreview}>{atk.payloadPreview}</code>
                  {firing[atk.id] && <div style={S.firingMsg}>⟳ Firing…</div>}
                </button>
              ))}
            </div>
          )}

          {/* ── TAB: SCENARIOS ─────────────────────────────────────── */}
          {activeTab === 'scenarios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {SCENARIOS.map(sc => (
                <div key={sc.id} style={{ ...S.scenarioCard, borderColor: sc.color }}>
                  <div style={S.scenarioTop}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...S.scenarioLabel, color: sc.color }}>{sc.label}</div>
                      <div style={S.scenarioDesc}>{sc.description}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.625rem' }}>
                        {sc.attacks.map((aId, i) => {
                          const a = ATTACKS.find(x => x.id === aId);
                          return a ? (
                            <span key={i} style={{ ...S.metaTag, borderColor: a.color + '55', color: a.color }}>
                              {a.icon} {a.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <div style={S.scenarioMeta}>
                        ⏱ ~{(sc.delays[sc.delays.length - 1] / 1000).toFixed(1)}s &nbsp;•&nbsp; {sc.attacks.length} attacks
                        {sc.sameIP && <> &nbsp;•&nbsp; <span style={{ color: '#f97316' }}>single IP</span></>}
                      </div>
                    </div>
                    <button
                      style={{
                        ...S.scenarioBtn,
                        borderColor: sc.color,
                        background:  sc.color + '18',
                        color:       sc.color,
                        opacity:     scenarioActive ? 0.5 : 1,
                        cursor:      scenarioActive ? 'not-allowed' : 'pointer',
                      }}
                      disabled={!!scenarioActive}
                      onClick={() => fireScenario(sc)}
                    >
                      {scenarioActive === sc.id ? (
                        <><span style={S.spinnerSm} /> Running…</>
                      ) : '▶ Launch'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB: CUSTOM BUILDER ────────────────────────────────── */}
          {activeTab === 'custom' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>🔧 Custom Attack Builder</div>
              <p style={S.panelDesc}>
                Build any payload and fire it directly into the Nexus engine.
                Leave IP blank for a fresh rotating IP.
              </p>
              <div style={S.customGrid}>
                {[
                  { label: 'IP Address', key: 'ip', type: 'text', placeholder: 'Blank = random fresh IP' },
                  { label: 'Target URL', key: 'url', type: 'text', placeholder: '/login' },
                  { label: 'Confidence (0–1)', key: 'confidence', type: 'number', min: 0, max: 1, step: 0.01 },
                ].map(f => (
                  <label key={f.key} style={S.fieldLabel}>
                    {f.label}
                    <input
                      style={S.input}
                      type={f.type}
                      min={f.min} max={f.max} step={f.step}
                      placeholder={f.placeholder}
                      value={custom[f.key]}
                      onChange={e => setCustom(c => ({ ...c, [f.key]: e.target.value }))}
                    />
                  </label>
                ))}
                <label style={S.fieldLabel}>
                  Attack Type
                  <select style={S.input} value={custom.attackType}
                    onChange={e => setCustom(c => ({ ...c, attackType: e.target.value }))}>
                    {ATTACK_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={S.fieldLabel}>
                  Severity
                  <select style={S.input} value={custom.severity}
                    onChange={e => setCustom(c => ({ ...c, severity: e.target.value }))}>
                    {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label style={S.fieldLabel}>
                  Method
                  <select style={S.input} value={custom.method}
                    onChange={e => setCustom(c => ({ ...c, method: e.target.value }))}>
                    {['GET','POST','PUT','DELETE','PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>
              <button style={S.dangerBtn} onClick={fireCustom} disabled={!!scenarioActive}>
                🔧 Fire Custom Attack
              </button>
            </div>
          )}

          {/* ── TAB: PAYLOAD MUTATOR ───────────────────────────────── */}
          {activeTab === 'mutate' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>🧬 Payload Mutator — Gemini WAF Evasion</div>
              <p style={S.panelDesc}>
                Paste any payload. Gemini generates evasion variants using different bypass techniques.
              </p>

              {/* Quick fill shortcuts */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.875rem' }}>
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted,#94a3b8)', alignSelf: 'center' }}>Quick fill:</span>
                {ATTACKS.map(a => (
                  <button key={a.id} style={S.ghostBtn}
                    onClick={() => {
                      setMutPayload(a.payloadPreview);
                      const typeMap = { cmdinject: 'command_injection', lfi: 'lfi_rfi', hpp: 'hpp' };
                      setMutType(typeMap[a.id] || a.id);
                    }}>
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={mutPayload}
                onChange={e => setMutPayload(e.target.value)}
                placeholder={"Paste payload, e.g.  ' OR 1=1 --   or   <script>alert(1)</script>"}
                style={S.mutTextarea}
              />

              <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={mutType} onChange={e => setMutType(e.target.value)} style={{ ...S.input, flex: 1, minWidth: '120px' }}>
                  {ATTACK_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button style={S.primaryBtn}
                  onClick={runMutation}
                  disabled={mutLoading || !mutPayload.trim()}>
                  {mutLoading ? <><span style={S.spinnerSm} /> Generating…</> : '🧠 Generate Variants'}
                </button>
              </div>

              {mutError && <div style={S.mutError}>{mutError}</div>}

              {mutResult && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={S.mutOriginalBox}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Original</span>
                    <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all', color: 'var(--color-text,#e2e8f0)' }}>{mutResult.original}</code>
                    {mutResult.generated && <span style={{ fontSize: '0.6875rem', color: '#22c55e' }}>🧠 Gemini-generated</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {mutResult.mutations?.map((m, i) => (
                      <div key={i} style={S.mutCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>#{i + 1} — {m.technique}</span>
                          <span style={{ ...S.sevBadge, background: (SEV_COLOR[m.risk] || '#f97316') + '22', color: SEV_COLOR[m.risk] || '#f97316' }}>{m.risk}</span>
                          <div style={{ display: 'flex', gap: '0.375rem', marginLeft: 'auto' }}>
                            <button style={S.ghostBtn} onClick={() => copyVariant(m.variant, i)}>
                              {copiedIdx === i ? '✅ Copied' : '📋 Copy'}
                            </button>
                            <button style={{ ...S.ghostBtn, color: '#f97316' }}
                              onClick={() => {
                                const match = ATTACKS.find(a => a.id === mutType.replace('command_injection','cmdinject').replace('lfi_rfi','lfi'));
                                if (match) fire({ ...match, payloadPreview: m.variant });
                              }}>
                              ⚡ Fire
                            </button>
                          </div>
                        </div>
                        <code style={S.mutVariant}>{m.variant}</code>
                        {m.evades && <p style={{ fontSize: '0.6875rem', color: '#94a3b8', margin: 0 }}><strong>Evades:</strong> {m.evades}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════ RIGHT PANEL ════════════ */}
        <div style={S.rightPanel}>

          {/* Live Event Feed */}
          <div style={S.feedCard}>
            <div style={S.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.8125rem' }}>
                <span style={S.pulseDot} />
                Live Event Feed
              </div>
              <button style={S.clearBtn} onClick={clearEvents}>Clear</button>
            </div>
            <div style={S.feedBody}>
              {liveEvents.length === 0 ? (
                <div style={S.emptyState}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>Fire an attack to see live socket events</span>
                </div>
              ) : liveEvents.map(ev => (
                <div key={ev.id} style={{ ...S.feedRow, borderLeftColor: ev.kind === 'block' ? '#ef4444' : '#3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ev.kind === 'block' ? '#ef4444' : '#60a5fa' }}>
                      {ev.type}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted,#94a3b8)' }}>{ev.time}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.125rem', alignItems: 'center' }}>
                    <code style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{ev.ip}</code>
                    {ev.severity !== 'critical' || ev.confidence !== '—' ? (
                      <span style={{ ...S.sevBadge, background: (SEV_COLOR[ev.severity] || '#64748b') + '22', color: SEV_COLOR[ev.severity] || '#64748b', fontSize: '0.5625rem' }}>
                        {ev.severity}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attack Log */}
          <div style={S.feedCard}>
            <div style={S.cardHeader}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                ⚔️ Attack Log <span style={{ color: 'var(--color-text-muted,#94a3b8)', fontWeight: 400 }}>({attackLog.length})</span>
              </div>
              <button style={S.clearBtn} onClick={clearLog}>Clear</button>
            </div>
            <div style={{ ...S.feedBody, maxHeight: '420px' }}>
              {attackLog.length === 0 ? (
                <div style={S.emptyState}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25">
                    <path d="M9 3h6M9 3v8l-4 9h14l-4-9V3"/>
                  </svg>
                  <span>Fired attacks will appear here</span>
                </div>
              ) : attackLog.map(log => (
                <div key={log.id} style={{ ...S.logEntry, borderLeftColor: log.color || '#3b82f6' }}>
                  {/* Row 1: icon + label + severity + time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem' }}>{log.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: log.color }}>{log.label}</span>
                    <span style={{ ...S.sevBadge, background: (SEV_COLOR[log.severity] || '#64748b') + '22', color: SEV_COLOR[log.severity] || '#64748b', fontSize: '0.5625rem' }}>
                      {log.severity}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--color-text-muted,#94a3b8)' }}>{log.time}</span>
                  </div>

                  {/* Row 2: IP + geo */}
                  <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <code style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{log.ip}</code>
                    {log.geoIntel?.country && (
                      <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        🌍 {log.geoIntel.country}
                        {log.geoIntel.tor_count > 0 && ' • 🧅 TOR'}
                        {log.geoIntel.proxy_count > 0 && ' • 🔀 Proxy'}
                      </span>
                    )}
                  </div>

                  {/* Row 3: payload preview */}
                  <code style={S.logPayload}>{log.payloadPreview}</code>

                  {/* Row 4: Pipeline tracker */}
                  <div style={S.pipeline}>
                    {PIPELINE_LABELS.map((label, idx) => (
                      <div key={idx} style={S.pipelineStep}>
                        <div style={{
                          ...S.pipelineDot,
                          background: log.status === 'error' && idx === 0
                            ? '#ef4444'
                            : idx <= log.step
                              ? '#22c55e'
                              : 'var(--color-border,#334155)',
                          boxShadow: idx === log.step && log.status !== 'error'
                            ? '0 0 6px #22c55e88'
                            : 'none',
                        }} />
                        <span style={{
                          ...S.pipelineLabel,
                          color: idx <= log.step
                            ? 'var(--color-text,#e2e8f0)'
                            : 'var(--color-text-muted,#94a3b8)',
                        }}>
                          {label}
                        </span>
                        {idx < PIPELINE_LABELS.length - 1 && (
                          <div style={{
                            ...S.pipelineConnector,
                            background: idx < log.step ? '#22c55e55' : 'var(--color-border,#334155)',
                          }} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Error detail */}
                  {log.detail && (
                    <div style={{ fontSize: '0.6875rem', color: '#ef4444', marginTop: '0.25rem' }}>{log.detail}</div>
                  )}

                  {/* Nexus action */}
                  {log.nexusAction && (
                    <div style={{ fontSize: '0.6875rem', color: '#f97316', marginTop: '0.25rem' }}>
                      🤖 Nexus: {log.nexusAction}
                    </div>
                  )}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes sentinal-spin    { to { transform: rotate(360deg); } }
        @keyframes sentinal-pulse   { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes sentinal-fadein  { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — all CSS variables, no hardcoded colours except severity indicators
═══════════════════════════════════════════════════════════════════════════ */
const S = {
  page: {
    padding: '1.25rem 1.5rem',
    fontFamily: 'inherit',
    color: 'var(--color-text,#e2e8f0)',
    minHeight: '100%',
  },
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: '1rem',
    marginBottom: '1.25rem', flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.375rem', fontWeight: 700, margin: 0,
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  subtitle: {
    margin: '0.25rem 0 0', fontSize: '0.8125rem',
    color: 'var(--color-text-muted,#94a3b8)', maxWidth: '52ch',
  },
  liveBadge: {
    fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em',
    padding: '0.2rem 0.5rem', borderRadius: '9999px',
    background: '#22c55e18', color: '#22c55e',
    border: '1px solid #22c55e44',
    animation: 'sentinal-pulse 2s ease-in-out infinite',
  },
  ipBadge: {
    fontSize: '0.6875rem', padding: '0.2rem 0.625rem',
    borderRadius: '9999px',
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid var(--color-border,#334155)',
    color: 'var(--color-text-muted,#94a3b8)',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,0.85fr)',
    gap: '1.125rem',
    alignItems: 'start',
  },
  leftPanel:  { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  rightPanel: { display: 'flex', flexDirection: 'column', gap: '0.875rem', position: 'sticky', top: '1rem' },

  /* Tab bar */
  tabBar: {
    display: 'flex', gap: '0.25rem',
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.625rem',
    padding: '0.25rem',
  },
  tab: {
    flex: 1, padding: '0.4rem 0.5rem',
    borderRadius: '0.375rem',
    background: 'transparent',
    border: 'none', color: 'var(--color-text-muted,#94a3b8)',
    fontWeight: 500, fontSize: '0.75rem', cursor: 'pointer',
    transition: 'all 150ms',
  },
  tabActive: {
    background: 'var(--color-bg,#0f172a)',
    color: 'var(--color-text,#e2e8f0)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },

  /* Attack grid */
  attackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
    gap: '0.625rem',
  },
  attackCard: {
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid',
    borderRadius: '0.625rem',
    padding: '0.875rem',
    textAlign: 'left', cursor: 'pointer',
    color: 'inherit',
    transition: 'opacity 150ms, transform 100ms, box-shadow 150ms',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: '0.375rem' },
  cardLabel: { fontWeight: 700, fontSize: '0.875rem' },
  cardDesc:  { fontSize: '0.75rem', color: 'var(--color-text-muted,#94a3b8)', lineHeight: 1.4 },
  cardMeta:  { display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.125rem' },
  payloadPreview: {
    display: 'block', fontSize: '0.625rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.25rem', padding: '0.25rem 0.5rem',
    color: '#94a3b8', wordBreak: 'break-all', lineHeight: 1.5, marginTop: '0.25rem',
  },
  firingDot: {
    marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%',
    background: '#22c55e',
    animation: 'sentinal-pulse 0.7s ease-in-out infinite',
    flexShrink: 0,
  },
  firingMsg: { fontSize: '0.6875rem', color: '#22c55e', fontWeight: 600 },

  /* Severity + confidence badges */
  sevBadge: {
    fontSize: '0.5625rem', fontWeight: 700, padding: '0.1rem 0.375rem',
    borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  confBadge: {
    fontSize: '0.625rem', color: 'var(--color-text-muted,#94a3b8)',
    marginLeft: 'auto',
  },
  metaTag: {
    fontSize: '0.625rem', padding: '0.1rem 0.375rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.25rem', color: 'var(--color-text-muted,#94a3b8)',
  },

  /* Scenario cards */
  scenarioCard: {
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid',
    borderRadius: '0.625rem',
    padding: '1rem 1.125rem',
    animation: 'sentinal-fadein 200ms ease',
  },
  scenarioTop:  { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
  scenarioLabel:{ fontWeight: 700, fontSize: '0.9375rem' },
  scenarioDesc: { fontSize: '0.8125rem', color: 'var(--color-text-muted,#94a3b8)', marginTop: '0.2rem' },
  scenarioMeta: { fontSize: '0.6875rem', color: '#64748b', marginTop: '0.5rem' },
  scenarioBtn:  {
    padding: '0.4rem 0.875rem', border: '1px solid',
    borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.8125rem',
    background: 'transparent', display: 'flex', alignItems: 'center',
    gap: '0.375rem', whiteSpace: 'nowrap', flexShrink: 0,
    transition: 'opacity 150ms',
  },

  /* Generic panel */
  panel: {
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.625rem', padding: '1.125rem',
    animation: 'sentinal-fadein 180ms ease',
  },
  panelTitle: { fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' },
  panelDesc:  { fontSize: '0.75rem', color: 'var(--color-text-muted,#94a3b8)', marginBottom: '1rem', lineHeight: 1.5 },

  /* Custom builder */
  customGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
    gap: '0.75rem',
  },
  fieldLabel: { fontSize: '0.75rem', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  input: {
    padding: '0.4rem 0.6rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.375rem', color: 'inherit',
    fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none',
    width: '100%',
  },

  /* Buttons */
  primaryBtn: {
    padding: '0.45rem 1rem',
    background: 'rgba(37,99,235,0.85)',
    border: '1px solid #3b82f6',
    borderRadius: '0.375rem', color: '#fff',
    fontWeight: 600, fontSize: '0.8125rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
    transition: 'opacity 150ms',
  },
  dangerBtn: {
    width: '100%', marginTop: '1rem',
    padding: '0.55rem',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid #ef4444',
    borderRadius: '0.375rem', color: '#ef4444',
    fontWeight: 700, fontSize: '0.875rem',
    cursor: 'pointer', transition: 'opacity 150ms',
  },
  ghostBtn: {
    padding: '0.2rem 0.625rem', fontSize: '0.6875rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.25rem', color: 'var(--color-text-muted,#94a3b8)',
    cursor: 'pointer', transition: 'color 120ms',
  },

  /* Mutator */
  mutTextarea: {
    width: '100%', padding: '0.625rem 0.75rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.375rem', color: 'inherit',
    fontSize: '0.8125rem', fontFamily: 'monospace',
    resize: 'vertical', outline: 'none', lineHeight: 1.5,
  },
  mutError: {
    marginTop: '0.75rem', padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#ef4444', fontSize: '0.8125rem',
  },
  mutOriginalBox: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    padding: '0.625rem 0.875rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.375rem',
  },
  mutCard: {
    padding: '0.625rem 0.875rem',
    background: 'var(--color-bg,#0f172a)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.375rem',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
    animation: 'sentinal-fadein 200ms ease',
  },
  mutVariant: {
    display: 'block', fontSize: '0.75rem',
    wordBreak: 'break-all', lineHeight: 1.5,
    color: '#f97316',
    background: 'var(--color-surface,#1e293b)',
    padding: '0.25rem 0.5rem', borderRadius: '0.25rem',
  },

  /* Right panel cards */
  feedCard: {
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.625rem', overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.625rem 0.875rem',
    borderBottom: '1px solid var(--color-border,#334155)',
  },
  pulseDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#22c55e', flexShrink: 0,
    boxShadow: '0 0 6px #22c55e',
    animation: 'sentinal-pulse 2s ease-in-out infinite',
    display: 'inline-block',
  },
  clearBtn: {
    fontSize: '0.6875rem', padding: '0.2rem 0.5rem',
    background: 'transparent',
    border: '1px solid var(--color-border,#334155)',
    borderRadius: '0.25rem',
    color: 'var(--color-text-muted,#94a3b8)',
    cursor: 'pointer',
  },
  feedBody: {
    overflowY: 'auto', maxHeight: '280px',
    padding: '0.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
    background: 'var(--color-bg,#0f172a)',
  },
  feedRow: {
    padding: '0.375rem 0.625rem',
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid var(--color-border,#334155)',
    borderLeft: '3px solid',
    borderRadius: '0.375rem',
    animation: 'sentinal-fadein 180ms ease',
  },

  /* Attack log entries */
  logEntry: {
    padding: '0.625rem 0.75rem',
    background: 'var(--color-surface,#1e293b)',
    border: '1px solid var(--color-border,#334155)',
    borderLeft: '3px solid',
    borderRadius: '0.375rem',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    animation: 'sentinal-fadein 180ms ease',
  },
  logPayload: {
    display: 'block', fontSize: '0.625rem',
    color: '#64748b', wordBreak: 'break-all',
    lineHeight: 1.4,
  },

  /* Pipeline tracker */
  pipeline: {
    display: 'flex', alignItems: 'center',
    gap: 0, marginTop: '0.375rem',
  },
  pipelineStep: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
  },
  pipelineDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    flexShrink: 0, transition: 'background 300ms, box-shadow 300ms',
  },
  pipelineLabel: {
    fontSize: '0.5625rem', fontWeight: 500, whiteSpace: 'nowrap',
    transition: 'color 300ms',
  },
  pipelineConnector: {
    height: '1px', width: '16px', flexShrink: 0,
    transition: 'background 300ms',
  },

  /* Empty state */
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '0.5rem',
    minHeight: '100px',
    color: 'var(--color-text-muted,#94a3b8)',
    fontSize: '0.75rem',
  },

  /* Spinner */
  spinnerSm: {
    display: 'inline-block', width: '12px', height: '12px',
    border: '2px solid currentColor', borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'sentinal-spin 0.65s linear infinite',
  },
};
