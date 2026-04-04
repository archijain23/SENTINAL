import { useState, useEffect, useCallback } from 'react';
import { alertsAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import SeverityBadge from '../components/ui/SeverityBadge';
import styles from './AlertsPage.module.css';

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info'];

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function AlertsPage() {
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [marking, setMarking]   = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await alertsAPI.getAll({ limit: 100 });
      setAlerts(Array.isArray(data) ? data : data?.alerts ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live: prepend new alerts via socket
  useEffect(() => {
    const socket = getSocket();
    socket.on(SOCKET_EVENTS.NEW_ALERT, (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 200));
    });
    return () => socket.off(SOCKET_EVENTS.NEW_ALERT);
  }, []);

  const markRead = async (id) => {
    setMarking(id);
    try {
      await alertsAPI.markRead(id);
      setAlerts(prev => prev.map(a => a._id === id || a.id === id ? { ...a, read: true, status: 'read' } : a));
    } catch {}
    setMarking(null);
  };

  const markAll = async () => {
    try {
      await alertsAPI.markAllRead();
      setAlerts(prev => prev.map(a => ({ ...a, read: true, status: 'read' })));
    } catch {}
  };

  const filtered = alerts.filter(a => {
    const sev = a.severity?.toLowerCase() ?? '';
    const matchSev = filter === 'all' || sev === filter;
    const matchSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.message?.toLowerCase().includes(search.toLowerCase()) ||
      a.sourceIP?.includes(search);
    return matchSev && matchSearch;
  });

  const unread = alerts.filter(a => !a.read && a.status !== 'read').length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Alerts</h1>
          {unread > 0 && <span className={styles.unreadBadge}>{unread} unread</span>}
        </div>
        <div className={styles.actions}>
          {unread > 0 && (
            <button className={styles.markAllBtn} onClick={markAll}>Mark all read</button>
          )}
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Search alerts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.severityTabs}>
          {SEVERITIES.map(s => (
            <button
              key={s}
              className={`${styles.sevTab} ${filter === s ? styles.sevTabActive : ''}`}
              onClick={() => setFilter(s)}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* Table */}
      {loading ? (
        <div className={styles.loadingRows}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p>No alerts match your filter</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Title</th>
                <th>Source IP</th>
                <th>Time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const id = a._id ?? a.id;
                const isRead = a.read || a.status === 'read';
                return (
                  <tr key={id} className={isRead ? styles.rowRead : styles.rowUnread}>
                    <td><SeverityBadge level={a.severity ?? 'info'} /></td>
                    <td className={styles.titleCell}>
                      <span className={styles.alertTitle}>{a.title ?? a.type ?? 'Alert'}</span>
                      {a.message && <span className={styles.alertMsg}>{a.message}</span>}
                    </td>
                    <td className={styles.mono}>{a.sourceIP ?? a.src_ip ?? '—'}</td>
                    <td className={styles.mono}>{a.timestamp || a.createdAt ? timeAgo(a.timestamp ?? a.createdAt) : '—'}</td>
                    <td>
                      <span className={isRead ? styles.statusRead : styles.statusUnread}>
                        {isRead ? 'read' : 'unread'}
                      </span>
                    </td>
                    <td>
                      {!isRead && (
                        <button
                          className={styles.markBtn}
                          onClick={() => markRead(id)}
                          disabled={marking === id}
                        >
                          {marking === id ? '…' : 'Mark read'}
                        </button>
                      )}
                    </td>
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
