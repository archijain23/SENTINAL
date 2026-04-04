import React, { useState, useRef, useEffect } from 'react';

const SCENARIOS = [
  {
    id: 'port_scan',
    label: 'Port Scan',
    icon: '🔍',
    description: 'Sweep target for open ports using SYN probes.',
    severity: 'LOW',
    steps: [
      'Initializing scanner module…',
      'Sending SYN probes to ports 1–1024…',
      'Response received on port 22 (SSH) — OPEN',
      'Response received on port 80 (HTTP) — OPEN',
      'Response received on port 443 (HTTPS) — OPEN',
      'Port 3306 (MySQL) — FILTERED',
      'Scan complete. 3 open, 1 filtered, 1020 closed.',
      '✔ Simulation finished.',
    ],
  },
  {
    id: 'brute_force',
    label: 'SSH Brute Force',
    icon: '🔓',
    description: 'Attempt credential stuffing against SSH service.',
    severity: 'HIGH',
    steps: [
      'Loading credential wordlist (10,000 entries)…',
      'Connecting to SSH on port 22…',
      'Attempting admin:admin — FAILED',
      'Attempting root:toor — FAILED',
      'Attempting ubuntu:ubuntu — FAILED',
      '⚠ Rate-limit detected — throttling to 2 req/s…',
      'Attempting pi:raspberry — FAILED',
      'Max attempts reached. No valid credentials found.',
      '✔ Simulation finished.',
    ],
  },
  {
    id: 'ddos',
    label: 'DDoS Flood',
    icon: '🌊',
    description: 'Simulate volumetric UDP flood attack.',
    severity: 'CRITICAL',
    steps: [
      'Spawning 50 virtual attack nodes…',
      'Generating UDP flood packets at 10 Gbps…',
      'Target bandwidth saturation: 12%',
      'Target bandwidth saturation: 47%',
      'Target bandwidth saturation: 89%',
      '⚠ Detection engine triggered — rule: DDOS_UDP_FLOOD',
      'Response engine issued: RATE_LIMIT + BLOCK_ASN',
      'Flood mitigated. Uptime maintained.',
      '✔ Simulation finished.',
    ],
  },
  {
    id: 'sqli',
    label: 'SQL Injection',
    icon: '💉',
    description: 'Test web endpoint for SQL injection vulnerability.',
    severity: 'HIGH',
    steps: [
      'Targeting HTTP endpoint: /api/users?id=1',
      "Injecting payload: ' OR 1=1 --",
      'Response: 200 OK — anomalous row count detected',
      "Injecting payload: ' UNION SELECT table_name FROM information_schema.tables --",
      '⚠ WAF rule triggered: SQLI_UNION_SELECT',
      'Request blocked with 403.',
      'Injection surface confirmed — WAF protection active.',
      '✔ Simulation finished.',
    ],
  },
  {
    id: 'c2_beacon',
    label: 'C2 Beacon',
    icon: '📡',
    description: 'Simulate command-and-control callback pattern.',
    severity: 'CRITICAL',
    steps: [
      'Spawning simulated implant process…',
      'Beacon interval set to 30s (jitter: ±5s)',
      'DNS query: c2.evil-domain.xyz — resolved to 185.220.0.1',
      'Establishing encrypted tunnel (TLS 1.3)…',
      'Heartbeat sent: {"id":"BOT-001","host":"target"}',
      '⚠ Nexus agent detected anomalous DNS pattern',
      'Alert raised: C2_BEACON_DETECTED [CRITICAL]',
      'Connection terminated by response engine.',
      '✔ Simulation finished.',
    ],
  },
];

const SEV_COLOR = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };

const LINE_COLOR = (line) => {
  if (line.startsWith('✔'))   return '#22c55e';
  if (line.startsWith('⚠'))   return '#eab308';
  if (line.includes('OPEN'))  return '#60a5fa';
  if (line.includes('BLOCK') || line.includes('triggered') || line.includes('CRITICAL'))
    return '#ef4444';
  return null; // inherit
};

export default function SimulatePage() {
  const [scenario,  setScenario]  = useState(SCENARIOS[0]);
  const [targetIP,  setTargetIP]  = useState('192.168.1.100');
  const [running,   setRunning]   = useState(false);
  const [logs,      setLogs]      = useState([]);
  const [done,      setDone]      = useState(false);
  const logEndRef = useRef(null);

  // Auto-scroll log panel
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const runSimulation = () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setLogs([]);

    const timestamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    const steps = [
      `[${timestamp()}] ▶ Starting scenario: ${scenario.label}`,
      `[${timestamp()}] ▶ Target: ${targetIP || '(no target set)'}`,
      `[${timestamp()}] ▶ Severity rating: ${scenario.severity}`,
      '---',
      ...scenario.steps,
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        setRunning(false);
        setDone(true);
        return;
      }
      const line = steps[i];
      setLogs(prev => [...prev, { text: line, ts: timestamp() }]);
      i++;
    }, 420);
  };

  const clearLog = () => {
    setLogs([]);
    setDone(false);
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'inherit', color: 'var(--color-text, #e2e8f0)' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 3h6M9 3v8l-4 9h14l-4-9V3"/>
          </svg>
          Attack Simulator
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)' }}>
          Safe sandbox — simulate attack patterns to verify detection &amp; response coverage
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: '1.25rem', alignItems: 'start' }}>

        {/* LEFT — Config Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Scenario Selector */}
          <div style={{
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid var(--color-border, #334155)', fontWeight: 600, fontSize: '0.875rem' }}>
              Scenario
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {SCENARIOS.map((sc, i) => (
                <button
                  key={sc.id}
                  onClick={() => { setScenario(sc); clearLog(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1.125rem',
                    borderTop: i > 0 ? '1px solid var(--color-border, #334155)' : 'none',
                    background: scenario.id === sc.id ? 'rgba(96,165,250,0.07)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    border: 'none', borderTop: i > 0 ? '1px solid var(--color-border, #334155)' : 'none',
                    color: 'inherit', transition: 'background 120ms',
                  }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{sc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {sc.label}
                      <span style={{
                        fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '9999px',
                        background: SEV_COLOR[sc.severity] + '22',
                        color: SEV_COLOR[sc.severity], fontWeight: 700, letterSpacing: '0.05em',
                      }}>{sc.severity}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: '0.1rem' }}>
                      {sc.description}
                    </div>
                  </div>
                  {scenario.id === sc.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Target IP */}
          <div style={{
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '0.75rem',
            padding: '1rem 1.125rem',
          }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Target IP / Host
            </label>
            <input
              type="text"
              value={targetIP}
              onChange={e => setTargetIP(e.target.value)}
              placeholder="e.g. 192.168.1.100"
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                background: 'var(--color-bg, #0f172a)',
                border: '1px solid var(--color-border, #334155)',
                borderRadius: '0.375rem', color: 'inherit',
                fontSize: '0.875rem', fontFamily: 'monospace', outline: 'none',
              }}
            />
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted, #94a3b8)' }}>
              Sandbox only — no real traffic is generated.
            </p>
          </div>

          {/* Run Button */}
          <button
            onClick={runSimulation}
            disabled={running}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: running
                ? 'rgba(96,165,250,0.15)'
                : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
              color: running ? '#60a5fa' : '#fff',
              fontWeight: 700, fontSize: '0.9375rem',
              cursor: running ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 150ms',
              boxShadow: running ? 'none' : '0 2px 12px rgba(37,99,235,0.35)',
            }}>
            {running ? (
              <>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Running…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run Simulation
              </>
            )}
          </button>
        </div>

        {/* RIGHT — Live Log Panel */}
        <div style={{
          background: 'var(--color-surface, #1e293b)',
          border: '1px solid var(--color-border, #334155)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '480px',
        }}>
          {/* Log toolbar */}
          <div style={{
            padding: '0.75rem 1.125rem',
            borderBottom: '1px solid var(--color-border, #334155)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: running ? '#22c55e' : done ? '#60a5fa' : '#334155',
                boxShadow: running ? '0 0 6px #22c55e' : 'none',
                transition: 'all 300ms',
              }} />
              {running ? 'Live Output' : done ? 'Run Complete' : 'Output Log'}
            </div>
            <button
              onClick={clearLog}
              disabled={running}
              style={{
                fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                background: 'transparent',
                border: '1px solid var(--color-border, #334155)',
                borderRadius: '0.375rem', color: 'var(--color-text-muted, #94a3b8)',
                cursor: running ? 'not-allowed' : 'pointer',
              }}>Clear</button>
          </div>

          {/* Log body */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.125rem',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            lineHeight: '1.7',
            background: 'var(--color-bg, #0f172a)',
          }}>
            {logs.length === 0 && !running ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '320px', color: 'var(--color-text-muted, #94a3b8)', gap: '0.75rem' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                  <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <p style={{ margin: 0, fontSize: '0.8125rem' }}>Select a scenario and press Run Simulation.</p>
              </div>
            ) : (
              <>
                {logs.map((entry, i) => {
                  const color = LINE_COLOR(entry.text);
                  const isDivider = entry.text === '---';
                  return isDivider ? (
                    <div key={i} style={{ borderTop: '1px solid var(--color-border, #334155)', margin: '0.5rem 0', opacity: 0.4 }} />
                  ) : (
                    <div
                      key={i}
                      style={{
                        color: color || 'var(--color-text, #e2e8f0)',
                        animation: 'fadeIn 200ms ease',
                        display: 'flex', gap: '0.75rem',
                      }}>
                      <span style={{ color: 'var(--color-text-muted, #94a3b8)', flexShrink: 0, userSelect: 'none' }}>
                        {entry.ts}
                      </span>
                      <span>{entry.text}</span>
                    </div>
                  );
                })}
                {running && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '0.5rem', paddingLeft: '5rem' }}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: '#60a5fa', opacity: 0.7,
                        animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                )}
                {done && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '0.8125rem', fontWeight: 600 }}>
                    ✔ Scenario complete — {scenario.label} on {targetIP || 'no target'}
                  </div>
                )}
                <div ref={logEndRef} />
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(2px); } to { opacity:1; transform:none; } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
      `}</style>
    </div>
  );
}
