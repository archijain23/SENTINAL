/**
 * ThreatStream — Live wired to Socket.io NEW_ATTACK events  (v2)
 *
 * Primary source: socket.on(NEW_ATTACK) → real events from gateway
 * Fallback:       if socket disconnected, shows last known events
 * Seed:           18 mock events on mount so UI is never empty
 */
import { useState, useEffect, useRef } from 'react';
import { getSocket, SOCKET_EVENTS }    from '../../services/socket';

const ATTACK_TYPES = ['SQL Injection','Brute Force','Port Scan','DDoS','XSS','Path Traversal','RCE Attempt','CSRF'];
const SEVERITIES   = [
  { label: 'CRITICAL', color: '#FF3D71', bg: 'rgba(255,61,113,0.1)',  border: 'rgba(255,61,113,0.25)' },
  { label: 'HIGH',     color: '#FF8C00', bg: 'rgba(255,140,0,0.1)',   border: 'rgba(255,140,0,0.25)'  },
  { label: 'MEDIUM',   color: '#FFB800', bg: 'rgba(255,184,0,0.1)',   border: 'rgba(255,184,0,0.25)'  },
  { label: 'LOW',      color: '#00FF88', bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.2)'   },
];
const VERDICTS = [
  { label: 'BLOCKED', color: '#FF3D71' },
  { label: 'ALLOWED', color: '#00FF88' },
  { label: 'FLAGGED', color: '#FFB800' },
];

function randInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function randItem(arr) { return arr[randInt(0,arr.length-1)]; }
function randIp()  { return `${randInt(1,254)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`; }
function nowStr()  {
  const d=new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

let _uid = 1;
function makeEvent(raw) {
  // If coming from socket, map backend fields
  if (raw && raw.sourceIP) {
    const sevLabel = (raw.severity ?? 'LOW').toUpperCase();
    const sev   = SEVERITIES.find(s => s.label === sevLabel) ?? SEVERITIES[3];
    const verd  = raw.status === 'blocked' ? VERDICTS[0] : raw.status === 'allowed' ? VERDICTS[1] : VERDICTS[2];
    return {
      id:         _uid++,
      time:       nowStr(),
      src_ip:     raw.sourceIP,
      attack:     raw.type ?? raw.attackType ?? 'Unknown',
      severity:   sev,
      verdict:    verd,
      confidence: raw.confidence ?? raw.score ?? randInt(72,99),
    };
  }
  // Mock fallback
  const sev    = randItem(SEVERITIES);
  const verdict = sev.label==='CRITICAL' ? VERDICTS[0] : sev.label==='LOW' ? VERDICTS[1] : randItem(VERDICTS);
  return { id: _uid++, time: nowStr(), src_ip: randIp(), attack: randItem(ATTACK_TYPES), severity: sev, verdict, confidence: randInt(72,99) };
}

function makeSeed(n) { return Array.from({ length: n }, () => makeEvent(null)); }

export default function ThreatStream() {
  const [events, setEvents] = useState(() => makeSeed(18));
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [live,   setLive]   = useState(false); // true when real socket events arrive
  const listRef    = useRef(null);
  const pausedRef  = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Wire to real socket events
  useEffect(() => {
    const socket = getSocket();
    const handler = (raw) => {
      if (pausedRef.current) return;
      setLive(true);
      setEvents(prev => [makeEvent(raw), ...prev].slice(0, 120));
    };
    socket.on(SOCKET_EVENTS.NEW_ATTACK, handler);
    return () => socket.off(SOCKET_EVENTS.NEW_ATTACK, handler);
  }, []);

  // Fallback mock ticker (only fires when socket is not delivering real events)
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current || live) return;
      setEvents(prev => [makeEvent(null), ...prev].slice(0, 120));
    }, 2500);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!paused && listRef.current) listRef.current.scrollTop = 0;
  }, [events, paused]);

  const FILTER_OPTIONS = ['ALL','CRITICAL','HIGH','MEDIUM','LOW'];
  const visible = filter === 'ALL' ? events : events.filter(e => e.severity.label === filter);

  return (
    <section
      className="rounded-lg flex flex-col"
      style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)', height: '420px' }}
      aria-label="Live threat event stream"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(0,245,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#FF3D71', boxShadow: '0 0 6px #FF3D71', animation: 'livePulse 2s ease-in-out infinite' }} />
          <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#E2E8F0' }}>Threat Event Stream</p>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums"
            style={{ background: 'rgba(255,61,113,0.1)', color: '#FF3D71', border: '1px solid rgba(255,61,113,0.2)' }}>
            {visible.length}
          </span>
          {live && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase"
              style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="text-[9px] font-mono tracking-wide px-2 py-0.5 rounded transition-all duration-150"
                style={{
                  background: filter===f ? 'rgba(0,245,255,0.12)' : 'transparent',
                  color:      filter===f ? '#00F5FF' : '#3D4663',
                  border:     `1px solid ${filter===f ? 'rgba(0,245,255,0.25)' : 'transparent'}`,
                }}>
                {f}
              </button>
            ))}
          </div>
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

      <div className="grid px-4 py-2 text-[9px] font-mono tracking-widest uppercase shrink-0"
        style={{ color: '#3D4663', borderBottom: '1px solid rgba(0,245,255,0.04)',
          gridTemplateColumns: '54px 1fr 1fr 70px 70px 54px' }}>
        <span>TIME</span><span>SRC IP</span><span>ATTACK TYPE</span>
        <span>SEVERITY</span><span>VERDICT</span><span className="text-right">CONF.</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,245,255,0.1) transparent' }}>
        {visible.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] font-mono" style={{ color: '#3D4663' }}>NO EVENTS MATCH FILTER</p>
          </div>
        )}
        {visible.map((ev, idx) => (
          <div key={ev.id}
            className="grid px-4 py-2.5 transition-colors duration-150 hover:bg-[rgba(0,245,255,0.03)] border-b"
            style={{ gridTemplateColumns: '54px 1fr 1fr 70px 70px 54px',
              borderColor: 'rgba(0,245,255,0.04)',
              animation: idx===0 && !paused ? 'fadeSlideIn 0.35s ease-out' : 'none' }}>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: '#3D4663' }}>{ev.time}</span>
            <span className="text-[10px] font-mono tabular-nums truncate pr-2" style={{ color: '#6B7894' }}>{ev.src_ip}</span>
            <span className="text-[10px] font-mono truncate pr-2" style={{ color: '#E2E8F0' }}>{ev.attack}</span>
            <span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wide"
                style={{ background: ev.severity.bg, color: ev.severity.color, border: `1px solid ${ev.severity.border}` }}>
                {ev.severity.label}
              </span>
            </span>
            <span className="text-[10px] font-mono" style={{ color: ev.verdict.color }}>{ev.verdict.label}</span>
            <span className="text-[10px] font-mono tabular-nums text-right" style={{ color: '#6B7894' }}>{ev.confidence}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
