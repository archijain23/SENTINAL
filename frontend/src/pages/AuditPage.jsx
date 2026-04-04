import { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '../services/api';
import styles from './AuditPage.module.css';

const ACTION_COLORS = {
  block:    '#FF3D71',
  unblock:  '#00FF88',
  approve:  '#00FF88',
  reject:   '#FF3D71',
  resolve:  '#00F5FF',
  login:    '#FFD700',
  logout:   '#718096',
  config:   '#FF8C00',
};

function timeStr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function exportCSV(rows) {
  const cols = ['timestamp', 'action', 'actor', 'target', 'details'];
  const lines = [
    cols.join(','),
    ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '—')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sentinal-audit-${Date.now()}.csv`;
  a.click();
}

export default function AuditPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await auditAPI.getLog(200);
      setLogs(Array.isArray(data) ? data : data?.logs ?? []);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = ['all', ...new Set(logs.map(l => l.action?.toLowerCase()).filter(Boolean))];

  const filtered = logs.filter(l => {
    const matchAction = filter === 'all' || l.action?.toLowerCase() === filter;
    const s = search.toLowerCase();
    const matchSearch = !search ||
      l.actor?.toLowerCase().includes(s) ||
      l.action?.toLowerCase().includes(s) ||
      l.target?.toLowerCase().includes(s) ||
      l.details?.toLowerCase().includes(s) ||
      String(l.ip ?? '').includes(s);
    return matchAction && matchSearch;
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Audit Log</h1>
        <div className={styles.headerRight}>
          <span className={styles.count}>{filtered.length} entries</span>
          <button className={styles.exportBtn} onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input className={styles.search} placeholder="Search actor, action, target…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.actionTabs}>
          {actions.slice(0, 8).map(a => (
            <button key={a} className={`${styles.actTab} ${filter === a ? styles.actTabActive : ''}`} onClick={() => setFilter(a)}>{a}</button>
          ))}
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* Table */}
      {loading ? (
        <div className={styles.skeletons}>{[...Array(8)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}><p>No audit entries match your filter</p></div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.map((l, i) => {
                const actionColor = ACTION_COLORS[l.action?.toLowerCase()] ?? '#718096';
                return (
                  <tr key={l._id ?? l.id ?? i}>
                    <td className={styles.mono}>{timeStr(l.timestamp ?? l.createdAt)}</td>
                    <td>
                      <span className={styles.actionBadge} style={{ color: actionColor, borderColor: actionColor + '33', background: actionColor + '12' }}>
                        {l.action ?? '—'}
                      </span>
                    </td>
                    <td className={styles.actor}>{l.actor ?? l.user ?? 'system'}</td>
                    <td className={styles.mono}>{l.target ?? l.ip ?? '—'}</td>
                    <td className={styles.details}>{l.details ?? l.reason ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
