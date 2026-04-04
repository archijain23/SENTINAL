import { useState, useEffect, useRef } from 'react';

// ── Mock data factory ────────────────────────────────────────────────────────
const ATTACK_TYPES  = ['SQL Injection', 'Brute Force', 'Port Scan', 'DDoS', 'XSS', 'Path Traversal', 'RCE Attempt', 'CSRF'];
const SEVERITIES    = [
  { label: 'CRITICAL', color: '#FF3D71', bg: 'rgba(255,61,113,0.1)',   border: 'rgba(255,61,113,0.25)' },
  { label: 'HIGH',     color: '#FF8C00', bg: 'rgba(255,140,0,0.1)',    border: 'rgba(255,140,0,0.25)' },
  { label: 'MEDIUM',   color: '#FFB800', bg: 'rgba(255,184,0,0.1)',    border: 'rgba(255,184,0,0.25)' },
  { label: 'LOW',      color: '#00FF88', bg: 'rgba(0,255,136,0.08)',   border: 'rgba(0,255,136,0.2)' },
];
const VERDICTS      = [
  { label: 'BLOCKED', color: '#FF3D71' },
  { label: 'ALLOWED', color: '#00FF88' },
  { label: 'FLAGGED', color: '#FFB800' },
];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randItem(arr)     { return arr[randInt(0, arr.length - 1)]; }
function randIp()          { return `${randInt(1,254)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`; }
function nowStr()          {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

let _uid = 1;
function makeEvent() {
  const sev     = randItem(SEVERITIES);
  const verdict = sev.label === 'CRITICAL'
    ? VERDICTS[0]
    : sev.label === 'LOW' ? VERDICTS[1] : randItem(VERDICTS);
  return {
    id:         _uid++,
    time:       nowStr(),
    src_ip:     randIp(),
    attack:     randItem(ATTACK_TYPES),
    severity:   sev,
    verdict,
    confidence: randInt(72, 99),
  };
}

function makeSeed(n) { return Array.from({ length: n }, makeEvent); }

// ── Component ────────────────────────────────────────────────────────────────
export default function ThreatStream() {
  const [events, setEvents]   = useState(() => makeSeed(18));
  const [paused, setPaused]   = useState(false);
  const [filter, setFilter]   = useState('ALL');
  const listRef               = useRef(null);
  const pausedRef             = useRef(false);

  // Keep pausedRef in sync so the interval can read it without stale closure
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Inject a new mock event every ~2.5 s
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setEvents(prev => [makeEvent(), ...prev].slice(0, 120)); // cap at 120
    }, 2500);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to top only if not paused
  useEffect(() => {
    if (!paused && listRef.current) listRef.current.scrollTop = 0;
  }, [events, paused]);

  const FILTER_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const visible = filter === 'ALL' ? events : events.filter(e => e.severity.label === filter);

  return (
    <section
      className="rounded-lg flex flex-col"
      style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)', height: '420px' }}
      aria-label="Live threat event stream"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(0,245,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#FF3D71', boxShadow: '0 0 6px #FF3D71', animation: 'livePulse 2s ease-in-out infinite' }}
          />
          <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#E2E8F0' }}>Threat Event Stream</p>
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums"
            style={{ background: 'rgba(255,61,113,0.1)', color: '#FF3D71', border: '1px solid rgba(255,61,113,0.2)' }}
          >
            {visible.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter pills */}
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-[9px] font-mono tracking-wide px-2 py-0.5 rounded transition-all duration-150"
                style={{
                  background: filter === f ? 'rgba(0,245,255,0.12)' : 'transparent',
                  color:      filter === f ? '#00F5FF' : '#3D4663',
                  border:     `1px solid ${filter === f ? 'rgba(0,245,255,0.25)' : 'transparent'}`,
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setPaused(p => !p)}
            className="flex items-center gap-1.5 text-[9px] font-mono tracking-wide px-2 py-1 rounded transition-all duration-150"
            style={{
              background: paused ? 'rgba(255,184,0,0.1)' : 'rgba(0,255,136,0.06)',
              color:      paused ? '#FFB800'             : '#00FF88',
              border:     `1px solid ${paused ? 'rgba(255,184,0,0.2)' : 'rgba(0,255,136,0.15)'}`,
            }}
            aria-label={paused ? 'Resume stream' : 'Pause stream'}
          >
            {paused ? (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 1l6 3-6 3V1z"/></svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><rect x="1" y="1" width="2" height="6"/><rect x="5" y="1" width="2" height="6"/></svg>
            )}
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div
        className="grid px-4 py-2 text-[9px] font-mono tracking-widest uppercase shrink-0"
        style={{ color: '#3D4663', borderBottom: '1px solid rgba(0,245,255,0.04)',
          gridTemplateColumns: '54px 1fr 1fr 70px 70px 54px' }}
      >
        <span>TIME</span>
        <span>SRC IP</span>
        <span>ATTACK TYPE</span>
        <span>SEVERITY</span>
        <span>VERDICT</span>
        <span className="text-right">CONF.</span>
      </div>

      {/* Scrollable event list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,245,255,0.1) transparent' }}
      >
        {visible.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] font-mono" style={{ color: '#3D4663' }}>NO EVENTS MATCH FILTER</p>
          </div>
        )}
        {visible.map((ev, idx) => (
          <div
            key={ev.id}
            className="grid px-4 py-2.5 transition-colors duration-150 hover:bg-[rgba(0,245,255,0.03)] border-b"
            style={{
              gridTemplateColumns: '54px 1fr 1fr 70px 70px 54px',
              borderColor: 'rgba(0,245,255,0.04)',
              animation: idx === 0 && !paused ? 'fadeSlideIn 0.35s ease-out' : 'none',
            }}
          >
            {/* Time */}
            <span className="text-[10px] font-mono tabular-nums" style={{ color: '#3D4663' }}>{ev.time}</span>

            {/* Src IP */}
            <span className="text-[10px] font-mono tabular-nums truncate pr-2" style={{ color: '#6B7894' }}>{ev.src_ip}</span>

            {/* Attack type */}
            <span className="text-[10px] font-mono truncate pr-2" style={{ color: '#E2E8F0' }}>{ev.attack}</span>

            {/* Severity badge */}
            <span>
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wide"
                style={{
                  background: ev.severity.bg,
                  color:      ev.severity.color,
                  border:     `1px solid ${ev.severity.border}`,
                }}
              >
                {ev.severity.label}
              </span>
            </span>

            {/* Verdict */}
            <span className="text-[10px] font-mono" style={{ color: ev.verdict.color }}>
              {ev.verdict.label}
            </span>

            {/* Confidence */}
            <span className="text-[10px] font-mono tabular-nums text-right" style={{ color: '#6B7894' }}>
              {ev.confidence}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
