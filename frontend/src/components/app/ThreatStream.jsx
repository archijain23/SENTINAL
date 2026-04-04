/**
 * ThreatStream — Live wired to Socket.io attack:new events
 *
 * Primary source: GET /api/attacks/recent on mount (real MongoDB data)
 * Real-time:      socket.on('attack:new') appends new events live
 * NO mock data:   empty state shows a clean "No events yet" message
 */
import { useState, useEffect, useRef } from 'react';
import { getSocket, SOCKET_EVENTS }    from '../../services/socket';
import { getRecentAttacks }            from '../../services/api';

// ── Severity / verdict maps ─────────────────────────────────────────────────────────
const SEV_MAP = {
  CRITICAL: { label:'CRITICAL', color:'#FF3D71', bg:'rgba(255,61,113,0.1)',  border:'rgba(255,61,113,0.25)' },
  HIGH:     { label:'HIGH',     color:'#FF8C00', bg:'rgba(255,140,0,0.1)',   border:'rgba(255,140,0,0.25)'  },
  MEDIUM:   { label:'MEDIUM',   color:'#FFB800', bg:'rgba(255,184,0,0.1)',   border:'rgba(255,184,0,0.25)'  },
  LOW:      { label:'LOW',      color:'#00FF88', bg:'rgba(0,255,136,0.08)',  border:'rgba(0,255,136,0.2)'   },
};
const VERDICT_MAP = {
  blocked:    { label:'BLOCKED', color:'#FF3D71' },
  successful: { label:'ALLOWED', color:'#FF3D71' },
  attempt:    { label:'FLAGGED', color:'#FFB800' },
};

let _uid = 1;

/**
 * Normalise a raw backend AttackEvent (REST or socket) into a display row.
 * Backend shape: { _id, ip, attackType, severity, status, confidence, createdAt, ... }
 */
function normalise(raw) {
  const sevKey = (raw.severity ?? 'low').toUpperCase();
  const sev    = SEV_MAP[sevKey] ?? SEV_MAP.LOW;
  const verdict = VERDICT_MAP[raw.status] ?? VERDICT_MAP.attempt;

  const ts = raw.createdAt ?? raw.timestamp ?? raw.lastSeen;
  let timeStr = '--:--:--';
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d)) {
      timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    }
  }

  return {
    id:         _uid++,
    _rawId:     raw._id ?? raw.id,
    time:       timeStr,
    src_ip:     raw.ip ?? raw.srcIP ?? raw.sourceIP ?? '—',
    attack:     raw.attackType ?? raw.type ?? 'Unknown',
    severity:   sev,
    verdict,
    confidence: raw.confidence != null
      ? Math.round(raw.confidence * (raw.confidence <= 1 ? 100 : 1))
      : null,
  };
}

// ── Skeleton row ─────────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="grid px-4 py-2.5 border-b" style={{
      gridTemplateColumns: '54px 1fr 1fr 70px 70px 54px',
      borderColor: 'rgba(0,245,255,0.04)',
    }}>
      {[40, 90, 110, 50, 50, 28].map((w, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center' }}>
          <div style={{
            height: '9px', width: `${w}px`, borderRadius: '3px',
            background: 'rgba(0,245,255,0.05)',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }} />
        </div>
      ))}
    </div>
  );
}

// ══ Component ════════════════════════════════════════════════════════════════════
export default function ThreatStream() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [paused,  setPaused]  = useState(false);
  const [filter,  setFilter]  = useState('ALL');
  const [live,    setLive]    = useState(false);
  const listRef   = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ─ Initial load from REST API ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRecentAttacks(50)
      .then(raw => {
        if (cancelled) return;
        // getRecentAttacks returns array directly (api.js unwraps via `unwrap`)
        const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.attacks ?? []);
        setEvents(list.map(normalise));
      })
      .catch(err => {
        if (!cancelled) console.warn('[ThreatStream] initial load failed:', err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ─ Real-time: socket attack:new ──────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    const handler = (raw) => {
      if (pausedRef.current) return;
      setLive(true);
      // Deduplicate by _id so a page-refresh doesn't double-add
      setEvents(prev => {
        const item = normalise(raw);
        // If this exact DB document is already in the list (e.g. from initial load), skip
        if (item._rawId && prev.some(e => e._rawId === item._rawId)) return prev;
        return [item, ...prev].slice(0, 150);
      });
    };
    socket.on(SOCKET_EVENTS.NEW_ATTACK, handler);
    // ⚠ Only socket.off — never disconnectSocket()
    return () => socket.off(SOCKET_EVENTS.NEW_ATTACK, handler);
  }, []);

  // Auto-scroll to top when new live event arrives
  useEffect(() => {
    if (!paused && listRef.current && events.length > 0) {
      listRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  const FILTER_OPTIONS = ['ALL','CRITICAL','HIGH','MEDIUM','LOW'];
  const visible = filter === 'ALL' ? events : events.filter(e => e.severity.label === filter);

  return (
    <section
      className="rounded-lg flex flex-col"
      style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)', height: '420px' }}
      aria-label="Live threat event stream"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(0,245,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full"
            style={{
              background:  live ? '#FF3D71' : '#3D4663',
              boxShadow:   live ? '0 0 6px #FF3D71' : 'none',
              animation:   live ? 'livePulse 2s ease-in-out infinite' : 'none',
            }} />
          <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#E2E8F0' }}>
            Threat Event Stream
          </p>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums"
            style={{ background:'rgba(255,61,113,0.1)', color:'#FF3D71', border:'1px solid rgba(255,61,113,0.2)' }}>
            {visible.length}
          </span>
          {live && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase"
              style={{ background:'rgba(0,255,136,0.08)', color:'#00FF88', border:'1px solid rgba(0,255,136,0.2)' }}>
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="text-[9px] font-mono tracking-wide px-2 py-0.5 rounded transition-all duration-150"
                style={{
                  background: filter===f ? 'rgba(0,245,255,0.12)' : 'transparent',
                  color:      filter===f ? '#00F5FF' : '#3D4663',
                  border:     `1px solid ${filter===f ? 'rgba(0,245,255,0.25)' : 'transparent'}`,
                }}>{f}
              </button>
            ))}
          </div>
          {/* Pause / resume */}
          <button onClick={() => setPaused(p => !p)}
            className="flex items-center gap-1.5 text-[9px] font-mono tracking-wide px-2 py-1 rounded transition-all duration-150"
            style={{
              background: paused ? 'rgba(255,184,0,0.1)' : 'rgba(0,255,136,0.06)',
              color:      paused ? '#FFB800' : '#00FF88',
              border:     `1px solid ${paused ? 'rgba(255,184,0,0.2)' : 'rgba(0,255,136,0.15)'}`,
            }}
            aria-label={paused ? 'Resume stream' : 'Pause stream'}>
            {paused
              ? <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 1l6 3-6 3V1z"/></svg>
              : <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><rect x="1" y="1" width="2" height="6"/><rect x="5" y="1" width="2" height="6"/></svg>}
            {paused ? 'RESUME' : 'PAUSE'}
          </button>
        </div>
      </div>

      {/* ── Column headers ── */}
      <div className="grid px-4 py-2 text-[9px] font-mono tracking-widest uppercase shrink-0"
        style={{ color:'#3D4663', borderBottom:'1px solid rgba(0,245,255,0.04)',
          gridTemplateColumns:'54px 1fr 1fr 70px 70px 54px' }}>
        <span>TIME</span>
        <span>SRC IP</span>
        <span>ATTACK TYPE</span>
        <span>SEVERITY</span>
        <span>STATUS</span>
        <span className="text-right">CONF.</span>
      </div>

      {/* ── List ── */}
      <div ref={listRef} className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth:'thin', scrollbarColor:'rgba(0,245,255,0.1) transparent' }}>

        {/* Loading skeleton */}
        {loading && (
          <>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</>
        )}

        {/* Empty state */}
        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="rgba(0,245,255,0.2)" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <p className="text-[10px] font-mono" style={{ color:'#3D4663' }}>
              {filter !== 'ALL'
                ? `No ${filter} events`
                : 'No attacks recorded yet — fire a simulation on /simulate'}
            </p>
          </div>
        )}

        {/* Real rows */}
        {!loading && visible.map((ev, idx) => (
          <div key={ev.id}
            className="grid px-4 py-2.5 transition-colors duration-150 hover:bg-[rgba(0,245,255,0.03)] border-b"
            style={{
              gridTemplateColumns: '54px 1fr 1fr 70px 70px 54px',
              borderColor: 'rgba(0,245,255,0.04)',
              animation: idx === 0 && live ? 'fadeSlideIn 0.35s ease-out' : 'none',
            }}>
            <span className="text-[10px] font-mono tabular-nums" style={{ color:'#3D4663' }}>{ev.time}</span>
            <span className="text-[10px] font-mono tabular-nums truncate pr-2" style={{ color:'#6B7894' }}>{ev.src_ip}</span>
            <span className="text-[10px] font-mono truncate pr-2" style={{ color:'#E2E8F0' }}>{ev.attack}</span>
            <span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wide"
                style={{ background:ev.severity.bg, color:ev.severity.color, border:`1px solid ${ev.severity.border}` }}>
                {ev.severity.label}
              </span>
            </span>
            <span className="text-[10px] font-mono" style={{ color:ev.verdict.color }}>{ev.verdict.label}</span>
            <span className="text-[10px] font-mono tabular-nums text-right" style={{ color:'#6B7894' }}>
              {ev.confidence != null ? `${ev.confidence}%` : '—'}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.3} 50%{opacity:.8} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }
      `}</style>
    </section>
  );
}
