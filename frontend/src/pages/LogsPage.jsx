import { useState, useEffect, useRef, useCallback } from 'react';
import { logsAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import styles from './LogsPage.module.css';

const LEVELS = ['all', 'error', 'warn', 'info', 'debug'];

const LEVEL_COLORS = {
  error: '#FF3D71',
  warn:  '#FF8C00',
  info:  '#00F5FF',
  debug: '#718096',
};

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogsPage() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [level, setLevel]         = useState('all');
  const [search, setSearch]       = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused]       = useState(false);
  const bottomRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await logsAPI.getRecent(200);
      setLogs(Array.isArray(data) ? data : data?.logs ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live stream via socket
  useEffect(() => {
    const socket = getSocket();
    socket.on(SOCKET_EVENTS.NEW_LOG, (log) => {
      if (pausedRef.current) return;
      setLogs(prev => [...prev, log].slice(-500));
    });
    return () => socket.off(SOCKET_EVENTS.NEW_LOG);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, paused]);

  const filtered = logs.filter(l => {
    const lv = l.level?.toLowerCase() ?? 'info';
    const matchLevel = level === 'all' || lv === level;
    const matchSearch = !search ||
      l.message?.toLowerCase().includes(search.toLowerCase()) ||
      l.service?.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>System Logs</h1>
        <div className={styles.controls}>
          <span className={styles.count}>{filtered.length} entries</span>
          <button
            className={`${styles.toggleBtn} ${paused ? styles.paused : styles.live}`}
            onClick={() => setPaused(p => !p)}
          >
            {paused ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
            )}
          </button>
          <label className={styles.autoScrollLabel}>
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Search logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.levelTabs}>
          {LEVELS.map(l => (
            <button
              key={l}
              className={`${styles.levTab} ${level === l ? styles.levTabActive : ''}`}
              style={level === l && l !== 'all' ? { color: LEVEL_COLORS[l], borderColor: LEVEL_COLORS[l] + '44' } : {}}
              onClick={() => setLevel(l)}
            >{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Log Terminal */}
      <div className={styles.terminal}>
        {loading ? (
          <div className={styles.termLoading}>Loading logs…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.termEmpty}>No logs match the current filter.</div>
        ) : (
          filtered.map((l, i) => {
            const lv = l.level?.toLowerCase() ?? 'info';
            const color = LEVEL_COLORS[lv] ?? '#718096';
            return (
              <div key={l._id ?? l.id ?? i} className={styles.logRow}>
                <span className={styles.logTime}>{fmt(l.timestamp ?? l.createdAt)}</span>
                <span className={styles.logLevel} style={{ color }}>{lv.toUpperCase().padEnd(5)}</span>
                <span className={styles.logService}>{(l.service ?? 'system').padEnd(12)}</span>
                <span className={styles.logMsg}>{l.message ?? l.msg ?? JSON.stringify(l)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
