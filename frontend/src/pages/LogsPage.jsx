import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logsAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import styles from './LogsPage.module.css';

/* ─── constants ───────────────────────────────────────────────────────── */
const LEVELS   = ['all', 'error', 'warn', 'info', 'debug'];
const LEVEL_META = {
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '✖', label: 'ERR' },
  warn:  { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  icon: '⚠', label: 'WRN' },
  info:  { color: '#22d3ee', bg: 'rgba(34,211,238,0.06)',  icon: '●', label: 'INF' },
  debug: { color: '#6b7280', bg: 'rgba(107,114,128,0.06)', icon: '○', label: 'DBG' },
};

/* ─── helpers ─────────────────────────────────────────────────────────── */
function tsLong(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    hour12: false, month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
function tsShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}
function tsDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format a latency number nicely */
function fmtLatency(ms) {
  if (ms == null || isNaN(ms)) return null;
  if (ms < 1)    return { value: (ms * 1000).toFixed(0), unit: 'µs', level: 'fast' };
  if (ms < 10)   return { value: ms.toFixed(2), unit: 'ms', level: 'fast' };
  if (ms < 100)  return { value: ms.toFixed(1), unit: 'ms', level: 'ok' };
  if (ms < 500)  return { value: ms.toFixed(0), unit: 'ms', level: 'slow' };
  if (ms < 2000) return { value: ms.toFixed(0), unit: 'ms', level: 'bad' };
  return { value: (ms / 1000).toFixed(2), unit: 's', level: 'bad' };
}

const LATENCY_COLOR = { fast: '#22c55e', ok: '#22d3ee', slow: '#f97316', bad: '#ef4444' };

/** Extract structured fields from a raw log object */
function parseLog(raw, index, prevTimestamp) {
  const ts     = raw.timestamp ?? raw.createdAt ?? raw.time ?? null;
  const lv     = (raw.level ?? 'info').toLowerCase();
  const svc    = raw.service ?? raw.source ?? raw.logger ?? 'system';
  const msg    = raw.message ?? raw.msg ?? JSON.stringify(raw);

  // latency: may be in multiple fields
  const latencyRaw =
    raw.latency ?? raw.responseTime ?? raw.duration ?? raw.elapsed ??
    raw.ms ?? raw['response-time'] ?? null;
  const latencyMs = latencyRaw != null ? Number(latencyRaw) : null;

  // inter-log delta
  let deltaMs = null;
  if (ts && prevTimestamp) {
    deltaMs = new Date(ts) - new Date(prevTimestamp);
    if (deltaMs < 0) deltaMs = null;
  }

  // HTTP fields
  const method     = raw.method ?? raw.httpMethod ?? null;
  const statusCode = raw.statusCode ?? raw.status ?? raw.httpStatus ?? null;
  const url        = raw.url ?? raw.path ?? raw.route ?? null;
  const ip         = raw.ip ?? raw.sourceIP ?? raw.remoteAddress ?? null;
  const userId     = raw.userId ?? raw.user ?? null;

  // extra meta (everything not already extracted)
  const KNOWN = new Set(['timestamp','createdAt','time','level','service','source',
    'logger','message','msg','latency','responseTime','duration','elapsed','ms',
    'response-time','method','httpMethod','statusCode','status','httpStatus',
    'url','path','route','ip','sourceIP','remoteAddress','userId','user',
    '_id','id','__v']);
  const extra = Object.fromEntries(Object.entries(raw).filter(([k]) => !KNOWN.has(k)));

  return { raw, index, ts, lv, svc, msg, latencyMs, deltaMs, method, statusCode, url, ip, userId, extra };
}

/** HTTP status color */
function statusColor(code) {
  if (!code) return null;
  const n = Number(code);
  if (n < 300) return '#22c55e';
  if (n < 400) return '#22d3ee';
  if (n < 500) return '#f97316';
  return '#ef4444';
}

/* ─── stats bar ───────────────────────────────────────────────────────── */
function StatsBar({ logs }) {
  const stats = useMemo(() => {
    const counts = { error: 0, warn: 0, info: 0, debug: 0 };
    const latencies = [];
    const services  = new Set();
    for (const l of logs) {
      counts[l.lv] = (counts[l.lv] ?? 0) + 1;
      if (l.latencyMs != null) latencies.push(l.latencyMs);
      services.add(l.svc);
    }
    const avgLat = latencies.length
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : null;
    const maxLat = latencies.length ? Math.max(...latencies) : null;
    const p95 = latencies.length
      ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
      : null;
    return { counts, avgLat, maxLat, p95, svcCount: services.size, total: logs.length };
  }, [logs]);

  const avg = fmtLatency(stats.avgLat);
  const p95 = fmtLatency(stats.p95);
  const max = fmtLatency(stats.maxLat);

  return (
    <div className={styles.statsBar}>
      <div className={styles.statItem}>
        <span className={styles.statVal}>{stats.total.toLocaleString()}</span>
        <span className={styles.statKey}>total</span>
      </div>
      <div className={styles.statDivider} />
      {['error','warn','info','debug'].map(lv => (
        <div key={lv} className={styles.statItem}>
          <span className={styles.statVal} style={{ color: LEVEL_META[lv].color }}>
            {stats.counts[lv] ?? 0}
          </span>
          <span className={styles.statKey}>{lv}</span>
        </div>
      ))}
      <div className={styles.statDivider} />
      <div className={styles.statItem}>
        <span className={styles.statVal}>{stats.svcCount}</span>
        <span className={styles.statKey}>services</span>
      </div>
      {avg && (
        <>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statVal} style={{ color: LATENCY_COLOR[avg.level] }}>
              {avg.value}<span className={styles.statUnit}>{avg.unit}</span>
            </span>
            <span className={styles.statKey}>avg latency</span>
          </div>
          {p95 && (
            <div className={styles.statItem}>
              <span className={styles.statVal} style={{ color: LATENCY_COLOR[p95.level] }}>
                {p95.value}<span className={styles.statUnit}>{p95.unit}</span>
              </span>
              <span className={styles.statKey}>p95</span>
            </div>
          )}
          {max && (
            <div className={styles.statItem}>
              <span className={styles.statVal} style={{ color: LATENCY_COLOR[max.level] }}>
                {max.value}<span className={styles.statUnit}>{max.unit}</span>
              </span>
              <span className={styles.statKey}>max</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── single log row ──────────────────────────────────────────────────── */
function LogRow({ log, showDate, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const meta   = LEVEL_META[log.lv] ?? LEVEL_META.info;
  const lat    = fmtLatency(log.latencyMs);
  const delta  = log.deltaMs != null && log.deltaMs > 0
    ? fmtLatency(log.deltaMs)
    : null;
  const sc     = statusColor(log.statusCode);
  const hasExtra = Object.keys(log.extra).length > 0;
  const canExpand = !!(log.url || log.ip || log.userId || hasExtra || log.method || log.statusCode);

  return (
    <div
      className={`${styles.logRow} ${isNew ? styles.logRowNew : ''} ${expanded ? styles.logRowExpanded : ''}`}
      style={{ borderLeftColor: meta.color + '66' }}
      onClick={() => canExpand && setExpanded(x => !x)}
    >
      {/* Main line */}
      <div className={styles.logMain}>
        {/* timestamp */}
        <div className={styles.logTs}>
          {showDate && <span className={styles.logDate}>{tsDate(log.ts)}</span>}
          <span className={styles.logTime}>{tsShort(log.ts)}</span>
        </div>

        {/* level badge */}
        <span
          className={styles.logLevel}
          style={{ color: meta.color, background: meta.bg }}
        >
          {meta.icon} {meta.label}
        </span>

        {/* service */}
        <span className={styles.logService}>{log.svc}</span>

        {/* HTTP method + status inline */}
        {log.method && (
          <span className={styles.methodTag}>{log.method}</span>
        )}
        {log.statusCode && (
          <span className={styles.statusTag} style={{ color: sc, borderColor: sc + '44' }}>
            {log.statusCode}
          </span>
        )}

        {/* message */}
        <span className={styles.logMsg}>{log.msg}</span>

        {/* latency pill — right-aligned */}
        <div className={styles.logRight}>
          {delta && (
            <span className={styles.deltaPill} title={`+${log.deltaMs?.toFixed(0)}ms since previous log`}>
              +{delta.value}{delta.unit}
            </span>
          )}
          {lat && (
            <span
              className={styles.latPill}
              style={{ color: LATENCY_COLOR[lat.level], borderColor: LATENCY_COLOR[lat.level] + '40' }}
              title={`Response latency: ${log.latencyMs}ms`}
            >
              ⏱ {lat.value}{lat.unit}
            </span>
          )}
          {canExpand && (
            <span className={styles.expandCaret}>{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={styles.logDetail}>
          <div className={styles.detailGrid}>
            {/* Timing section */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>⏱ Timing</div>
              <div className={styles.detailRow}>
                <span className={styles.detailKey}>Timestamp</span>
                <span className={styles.detailVal}>{tsLong(log.ts)}</span>
              </div>
              {log.latencyMs != null && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Latency</span>
                  <span className={styles.detailVal} style={{ color: LATENCY_COLOR[lat?.level] }}>
                    {log.latencyMs.toFixed(2)} ms
                    {lat && ` (${lat.level})`}
                  </span>
                </div>
              )}
              {log.deltaMs != null && (
                <div className={styles.detailRow}>
                  <span className={styles.detailKey}>Since prev log</span>
                  <span className={styles.detailVal}>+{log.deltaMs.toFixed(0)} ms</span>
                </div>
              )}
            </div>

            {/* HTTP section */}
            {(log.method || log.statusCode || log.url || log.ip) && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>🌐 Request</div>
                {log.method && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Method</span>
                    <span className={styles.detailVal}>
                      <span className={styles.methodTag}>{log.method}</span>
                    </span>
                  </div>
                )}
                {log.statusCode && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>Status</span>
                    <span className={styles.detailVal} style={{ color: sc }}>{log.statusCode}</span>
                  </div>
                )}
                {log.url && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>URL</span>
                    <code className={styles.detailCode}>{log.url}</code>
                  </div>
                )}
                {log.ip && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>IP</span>
                    <code className={styles.detailCode}>{log.ip}</code>
                  </div>
                )}
                {log.userId && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailKey}>User</span>
                    <span className={styles.detailVal}>{log.userId}</span>
                  </div>
                )}
              </div>
            )}

            {/* Extra fields */}
            {hasExtra && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>📋 Extra Fields</div>
                {Object.entries(log.extra).map(([k, v]) => (
                  <div key={k} className={styles.detailRow}>
                    <span className={styles.detailKey}>{k}</span>
                    <code className={styles.detailCode}>
                      {typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}
                    </code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── date separator ──────────────────────────────────────────────────── */
function DateSep({ label }) {
  return (
    <div className={styles.dateSep}>
      <div className={styles.dateSepLine} />
      <span className={styles.dateSepLabel}>{label}</span>
      <div className={styles.dateSepLine} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LOGS PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function LogsPage() {
  const [rawLogs, setRawLogs]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [level,   setLevel]         = useState('all');
  const [search,  setSearch]        = useState('');
  const [svcFilter, setSvcFilter]   = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused,  setPaused]        = useState(false);
  const [newIds,  setNewIds]        = useState(new Set());
  const bottomRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  /* load */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await logsAPI.getRecent(300);
      setRawLogs(Array.isArray(data) ? data : data?.logs ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* live socket */
  useEffect(() => {
    const socket = getSocket();
    const onNew = (log) => {
      if (pausedRef.current) return;
      const id = log._id ?? log.id ?? Date.now();
      setRawLogs(prev => [...prev, log].slice(-600));
      setNewIds(prev => { const s = new Set(prev); s.add(id); return s; });
      setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(id); return s; }), 2000);
    };
    socket.on(SOCKET_EVENTS.NEW_LOG, onNew);
    return () => socket.off(SOCKET_EVENTS.NEW_LOG, onNew);
  }, []);

  /* auto-scroll */
  useEffect(() => {
    if (autoScroll && !paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawLogs, autoScroll, paused]);

  /* parse all logs with delta timing */
  const parsed = useMemo(() => {
    const arr = [];
    for (let i = 0; i < rawLogs.length; i++) {
      const prev = arr[i - 1]?.ts ?? null;
      arr.push(parseLog(rawLogs[i], i, prev));
    }
    return arr;
  }, [rawLogs]);

  /* unique services */
  const services = useMemo(() => {
    const s = new Set(parsed.map(l => l.svc));
    return ['all', ...Array.from(s).sort()];
  }, [parsed]);

  /* filter */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return parsed.filter(l => {
      const okLv  = level === 'all' || l.lv === level;
      const okSvc = svcFilter === 'all' || l.svc === svcFilter;
      const okQ   = !q ||
        l.msg.toLowerCase().includes(q) ||
        l.svc.toLowerCase().includes(q) ||
        (l.ip ?? '').includes(q) ||
        (l.url ?? '').toLowerCase().includes(q);
      return okLv && okSvc && okQ;
    });
  }, [parsed, level, svcFilter, search]);

  /* date-separated render list */
  const renderItems = useMemo(() => {
    const items = [];
    let lastDate = null;
    for (const log of filtered) {
      const d = tsDate(log.ts);
      if (d !== lastDate) {
        items.push({ type: 'sep', label: d, key: 'sep-' + d });
        lastDate = d;
      }
      items.push({ type: 'log', log, key: log.raw._id ?? log.raw.id ?? log.index });
    }
    return items;
  }, [filtered]);

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>System Logs</h1>
          <span className={styles.countBadge}>{filtered.length.toLocaleString()} entries</span>
        </div>
        <div className={styles.headerControls}>
          <button
            className={`${styles.pauseBtn} ${paused ? styles.pauseBtnPaused : ''}`}
            onClick={() => setPaused(p => !p)}
          >
            {paused ? (
              <><PlayIcon /> Resume<span className={styles.pausedTag}>PAUSED</span></>
            ) : (
              <><PauseIcon /> Pause</>
            )}
          </button>
          <label className={styles.scrollToggle}>
            <input type="checkbox" checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)} />
            <span>Auto-scroll</span>
          </label>
          <button className={styles.refreshBtn} onClick={load} disabled={loading} title="Reload logs">
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <StatsBar logs={parsed} />

      {/* ── Filters ── */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Search message, service, IP, URL…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.levelTabs}>
          {LEVELS.map(l => {
            const m = LEVEL_META[l];
            return (
              <button key={l}
                className={`${styles.levTab} ${level === l ? styles.levTabActive : ''}`}
                style={level === l && l !== 'all' ? { color: m.color, borderColor: m.color + '44', background: m.bg } : {}}
                onClick={() => setLevel(l)}
              >
                {l !== 'all' && <span style={{ color: m?.color }}>{m?.icon} </span>}
                {l.toUpperCase()}
              </button>
            );
          })}
        </div>
        {services.length > 2 && (
          <select
            className={styles.svcSelect}
            value={svcFilter}
            onChange={e => setSvcFilter(e.target.value)}
          >
            {services.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Services' : s}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Log Terminal ── */}
      <div className={styles.terminal}>
        {loading ? (
          <div className={styles.termLoading}>
            <span className={styles.spinner} /> Loading logs…
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.termEmpty}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
            </svg>
            <span>No logs match the current filter</span>
          </div>
        ) : (
          renderItems.map(item =>
            item.type === 'sep'
              ? <DateSep key={item.key} label={item.label} />
              : <LogRow
                  key={item.key}
                  log={item.log}
                  showDate={false}
                  isNew={newIds.has(item.log.raw._id ?? item.log.raw.id ?? item.log.index)}
                />
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ─── inline SVG icons ───────────────────────────────────────────────── */
function PauseIcon() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>);
}
function PlayIcon() {
  return (<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>);
}
function RefreshIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>);
}
