/**
 * SettingsPage — Full settings UI
 *
 * Sections:
 *   1. Detection Thresholds
 *   2. Alert Rules
 *   3. AI Feature Toggles
 *   4. API Key Management
 *
 * GET  /api/settings      — load
 * PUT  /api/settings      — save (per section)
 * POST /api/settings/test-api-key — validate Gemini key
 */
import { useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../services/api';

/* ── tiny shared tokens ───────────────────────────────────────────────────── */
const C = {
  bg:      '#0D1117',
  surface: '#161B22',
  border:  'rgba(0,245,255,0.10)',
  borderD: 'rgba(0,245,255,0.06)',
  cyan:    '#00F5FF',
  green:   '#00FF88',
  red:     '#FF3D71',
  yellow:  '#FFD700',
  muted:   '#6B7894',
  text:    '#B8C4E0',
  textDim: '#4A5568',
};

const sectionStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  padding: '20px 24px',
  marginBottom: '16px',
};

const labelStyle = {
  fontFamily: 'monospace',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: C.muted,
  marginBottom: '14px',
  display: 'block',
};

const fieldRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: `1px solid ${C.borderD}`,
};

const fieldLabel = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: C.text,
  flex: 1,
};

const fieldDesc = {
  fontFamily: 'monospace',
  fontSize: '10px',
  color: C.muted,
  marginTop: '2px',
};

const inputStyle = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  color: C.cyan,
  fontFamily: 'monospace',
  fontSize: '12px',
  padding: '5px 10px',
  width: '110px',
  outline: 'none',
  textAlign: 'right',
};

const selectStyle = {
  ...inputStyle,
  width: '120px',
  cursor: 'pointer',
};

const saveBtn = (saving, saved) => ({
  background: saving ? 'rgba(0,245,255,0.05)' : saved ? 'rgba(0,255,136,0.12)' : 'rgba(0,245,255,0.10)',
  border: `1px solid ${saving ? C.border : saved ? C.green : C.cyan}`,
  borderRadius: '6px',
  color: saving ? C.muted : saved ? C.green : C.cyan,
  fontFamily: 'monospace',
  fontSize: '11px',
  padding: '7px 20px',
  cursor: saving ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

/* ── Toggle switch ───────────────────────────────────────────────────────── */
function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={{
        width: '44px', height: '24px',
        borderRadius: '12px',
        background: value ? 'rgba(0,255,136,0.25)' : 'rgba(107,120,148,0.2)',
        border: `1px solid ${value ? C.green : C.muted}`,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: value ? '22px' : '3px',
        width: '16px', height: '16px',
        borderRadius: '50%',
        background: value ? C.green : C.muted,
        transition: 'left 0.18s',
      }} />
    </button>
  );
}

/* ── Save status pill ────────────────────────────────────────────────────── */
function SaveStatus({ status, error }) {
  if (!status && !error) return null;
  return (
    <span style={{
      fontFamily: 'monospace', fontSize: '10px',
      color: error ? C.red : C.green,
      marginLeft: '12px',
      opacity: 0.9,
    }}>
      {error ? `⚠ ${error}` : '✓ Saved'}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — Detection Thresholds
══════════════════════════════════════════════════════════════════════════════ */
function DetectionSection({ data, onSave }) {
  const [local, setLocal]   = useState(data);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState(null);

  useEffect(() => setLocal(data), [data]);

  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setSaved(false); setErr(null);
    try {
      await onSave({ detection: local });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const pct = Math.round((local.confidenceThreshold ?? 0.7) * 100);

  return (
    <div style={sectionStyle}>
      <span style={labelStyle}>Detection Thresholds</span>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>Confidence Threshold</div>
          <div style={fieldDesc}>Minimum model confidence to register as an attack</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="range" min="0" max="100" step="1"
            value={pct}
            onChange={e => set('confidenceThreshold', e.target.value / 100)}
            style={{ width: '120px', accentColor: C.cyan }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '13px', color: C.cyan, minWidth: '36px', textAlign: 'right' }}>
            {pct}%
          </span>
        </div>
      </div>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>Severity Floor</div>
          <div style={fieldDesc}>Ignore events below this severity level</div>
        </div>
        <select
          value={local.severityFloor ?? 'low'}
          onChange={e => set('severityFloor', e.target.value)}
          style={selectStyle}
        >
          {['low','medium','high','critical'].map(s => (
            <option key={s} value={s} style={{ background: C.bg }}>{s.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>Auto-block on Critical</div>
          <div style={fieldDesc}>Automatically add critical-severity IPs to blocklist</div>
        </div>
        <Toggle value={local.autoBlockOnCritical ?? true} onChange={v => set('autoBlockOnCritical', v)} />
      </div>

      <div style={{ ...fieldRow, borderBottom: 'none' }}>
        <div>
          <div style={fieldLabel}>Auto-block on High</div>
          <div style={fieldDesc}>Automatically add high-severity IPs to blocklist</div>
        </div>
        <Toggle value={local.autoBlockOnHigh ?? false} onChange={v => set('autoBlockOnHigh', v)} />
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={saveBtn(saving, saved)}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Thresholds'}
        </button>
        <SaveStatus status={saved} error={err} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — Alert Rules
══════════════════════════════════════════════════════════════════════════════ */
function AlertRulesSection({ data, onSave }) {
  const [local, setLocal]   = useState(data);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState(null);

  useEffect(() => setLocal(data), [data]);

  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setSaved(false); setErr(null);
    try {
      await onSave({ alerts: local });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={sectionStyle}>
      <span style={labelStyle}>Alert Rules</span>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>Minimum Alert Severity</div>
          <div style={fieldDesc}>Only generate alerts at or above this severity</div>
        </div>
        <select
          value={local.minSeverity ?? 'medium'}
          onChange={e => set('minSeverity', e.target.value)}
          style={selectStyle}
        >
          {['low','medium','high','critical'].map(s => (
            <option key={s} value={s} style={{ background: C.bg }}>{s.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>Alert Cooldown</div>
          <div style={fieldDesc}>Minimum minutes between repeat alerts for same IP</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number" min="0" max="1440"
            value={local.cooldownMinutes ?? 5}
            onChange={e => set('cooldownMinutes', parseInt(e.target.value, 10) || 0)}
            style={inputStyle}
          />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted }}>MIN</span>
        </div>
      </div>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>Max Alerts / Hour</div>
          <div style={fieldDesc}>Rate cap — prevents alert storms from flooding the queue</div>
        </div>
        <input
          type="number" min="1" max="10000"
          value={local.maxAlertsPerHour ?? 50}
          onChange={e => set('maxAlertsPerHour', parseInt(e.target.value, 10) || 1)}
          style={inputStyle}
        />
      </div>

      <div style={{ ...fieldRow, borderBottom: 'none' }}>
        <div>
          <div style={fieldLabel}>Email Notifications</div>
          <div style={fieldDesc}>Send email alerts for critical events (requires SMTP config)</div>
        </div>
        <Toggle value={local.emailNotifications ?? false} onChange={v => set('emailNotifications', v)} />
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={saveBtn(saving, saved)}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Alert Rules'}
        </button>
        <SaveStatus status={saved} error={err} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — AI Feature Toggles
══════════════════════════════════════════════════════════════════════════════ */
function AITogglesSection({ data, onSave }) {
  const [local, setLocal]   = useState(data);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState(null);

  useEffect(() => setLocal(data), [data]);

  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setSaved(false); setErr(null);
    try {
      await onSave({ ai: local });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const toggles = [
    { key: 'copilotEnabled',     label: 'AI Copilot',           desc: 'Enable Gemini-powered security Q&A on /copilot' },
    { key: 'streamingEnabled',   label: 'Streaming Responses',  desc: 'Stream Copilot answers token-by-token (SSE)' },
    { key: 'correlationEnabled', label: 'Attack Correlation',   desc: 'Gemini campaign analysis on /correlation' },
    { key: 'mutationEnabled',    label: 'Payload Mutation',     desc: 'AI WAF-bypass variant generation on /simulate' },
  ];

  return (
    <div style={sectionStyle}>
      <span style={labelStyle}>AI Feature Toggles</span>

      {toggles.map((t, i) => (
        <div key={t.key} style={{ ...fieldRow, ...(i === toggles.length - 1 ? { borderBottom: 'none' } : {}) }}>
          <div>
            <div style={fieldLabel}>{t.label}</div>
            <div style={fieldDesc}>{t.desc}</div>
          </div>
          <Toggle value={local[t.key] ?? true} onChange={v => set(t.key, v)} />
        </div>
      ))}

      <div style={{ ...fieldRow, borderBottom: 'none', marginTop: '4px' }}>
        <div>
          <div style={fieldLabel}>Max Output Tokens</div>
          <div style={fieldDesc}>Maximum tokens per AI response (256 – 8192)</div>
        </div>
        <input
          type="number" min="256" max="8192" step="256"
          value={local.maxTokens ?? 1024}
          onChange={e => set('maxTokens', parseInt(e.target.value, 10) || 1024)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={saveBtn(saving, saved)}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save AI Settings'}
        </button>
        <SaveStatus status={saved} error={err} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 — API Key Management
══════════════════════════════════════════════════════════════════════════════ */
function ApiKeySection({ apiKey }) {
  const [testing,   setTesting]   = useState(false);
  const [testResult, setTestResult] = useState(null);

  async function testKey() {
    setTesting(true); setTestResult(null);
    try {
      const result = await settingsAPI.testApiKey();
      setTestResult(result);
    } catch (e) {
      setTestResult({ valid: false, reason: e.message });
    } finally { setTesting(false); }
  }

  const configured = apiKey?.configured;

  return (
    <div style={sectionStyle}>
      <span style={labelStyle}>API Key Management</span>

      <div style={{ ...fieldRow }}>
        <div>
          <div style={fieldLabel}>GEMINI_API_KEY</div>
          <div style={fieldDesc}>Set in backend/.env — never exposed to the browser</div>
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: '12px',
          color: configured ? C.green : C.red,
          background: configured ? 'rgba(0,255,136,0.08)' : 'rgba(255,61,113,0.08)',
          border: `1px solid ${configured ? 'rgba(0,255,136,0.2)' : 'rgba(255,61,113,0.2)'}`,
          borderRadius: '5px',
          padding: '4px 10px',
        }}>
          {configured ? '● CONFIGURED' : '○ NOT SET'}
        </span>
      </div>

      {configured && (
        <div style={{ ...fieldRow }}>
          <div>
            <div style={fieldLabel}>Key Preview</div>
            <div style={fieldDesc}>Last 4 characters visible for identification</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: C.muted, letterSpacing: '0.05em' }}>
            {apiKey?.masked ?? '••••••••••••••••••••'}
          </span>
        </div>
      )}

      <div style={{ ...fieldRow, borderBottom: 'none' }}>
        <div>
          <div style={fieldLabel}>Active Model Chain</div>
          <div style={fieldDesc}>Free-tier fallback order (April 2026)</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          {['gemini-2.5-flash', 'gemini-2.5-flash-8b', 'gemini-2.5-flash-lite'].map((m, i) => (
            <span key={m} style={{ fontFamily: 'monospace', fontSize: '10px', color: i === 0 ? C.cyan : C.muted }}>
              {i === 0 ? '① ' : i === 1 ? '② ' : '③ '}{m}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={testKey}
          disabled={testing || !configured}
          style={saveBtn(testing, false)}
        >
          {testing ? 'Testing…' : 'Test API Key'}
        </button>

        {testResult && (
          <span style={{
            fontFamily: 'monospace', fontSize: '11px',
            color: testResult.valid ? C.green : C.red,
          }}>
            {testResult.valid
              ? `✓ Valid — ${testResult.model}`
              : `✗ ${testResult.reason}`}
          </span>
        )}

        {!configured && (
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: C.yellow }}>
            Add GEMINI_API_KEY=your_key to backend/.env and restart
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState(null);

  useEffect(() => {
    settingsAPI.get()
      .then(data => setSettings(data))
      .catch(e  => setLoadErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async (partial) => {
    const updated = await settingsAPI.update(partial);
    setSettings(updated);
    return updated;
  }, []);

  return (
    <div style={{ maxWidth: '780px', padding: '0 4px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'monospace', fontWeight: 700,
          fontSize: '13px', letterSpacing: '0.18em',
          textTransform: 'uppercase', color: C.cyan,
          marginBottom: '4px',
        }}>
          System Settings
        </h1>
        <p style={{ fontFamily: 'monospace', fontSize: '11px', color: C.muted }}>
          Configure detection behaviour, alert rules, AI features, and API keys.
          Changes take effect immediately — no restart required.
        </p>
      </div>

      {/* Load error */}
      {loadErr && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: 'rgba(255,61,113,0.08)',
          border: '1px solid rgba(255,61,113,0.25)',
          fontFamily: 'monospace', fontSize: '12px', color: C.red,
        }}>
          ⚠ Failed to load settings: {loadErr}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              ...sectionStyle,
              height: '140px',
              background: 'rgba(22,27,34,0.6)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {/* Sections */}
      {!loading && settings && (
        <>
          <DetectionSection data={settings.detection} onSave={handleSave} />
          <AlertRulesSection data={settings.alerts}    onSave={handleSave} />
          <AITogglesSection  data={settings.ai}        onSave={handleSave} />
          <ApiKeySection     apiKey={settings.apiKey} />
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 0.9; }
        }
        input[type=range]::-webkit-slider-thumb { background: #00F5FF; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        select option { background: #0D1117; color: #B8C4E0; }
      `}</style>
    </div>
  );
}
