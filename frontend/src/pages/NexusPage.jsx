import { useState, useEffect, useCallback } from 'react';
import { nexusAPI, healthAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusDot from '../components/ui/StatusDot';
import styles from './NexusPage.module.css';

const TABS = ['queue', 'history'];

function timeStr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function NexusPage() {
  const [tab,       setTab]       = useState('queue');
  const [queue,     setQueue]     = useState([]);
  const [history,   setHistory]   = useState([]);
  const [agentUp,   setAgentUp]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState(null);
  const [error,     setError]     = useState(null);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      const [q, h] = await Promise.all([
        nexusAPI.getPending(),
        nexusAPI.getHistory(50),
      ]);
      setQueue(Array.isArray(q) ? q : q?.actions ?? []);
      setHistory(Array.isArray(h) ? h : h?.actions ?? []);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => {
    loadQueue();
    // Check nexus-agent health
    healthAPI.serviceStatus()
      .then(res => {
        const svcs = Array.isArray(res) ? res : res?.services ?? [];
        const nx   = svcs.find(s => /nexus/i.test(s.name ?? s.service ?? ''));
        setAgentUp(nx?.status === 'online' || nx?.status === 'healthy');
      })
      .catch(() => setAgentUp(false));
  }, [loadQueue]);

  // Live queue updates
  useEffect(() => {
    const s = getSocket();
    s.on(SOCKET_EVENTS.QUEUE_UPDATE, (item) => {
      setQueue(prev => {
        const exists = prev.find(a => a._id === item._id || a.id === item.id);
        if (exists) return prev.map(a => (a._id === item._id || a.id === item.id) ? { ...a, ...item } : a);
        return [item, ...prev];
      });
    });
    return () => s.off(SOCKET_EVENTS.QUEUE_UPDATE);
  }, []);

  const decide = async (id, action) => {
    setActing(id + action);
    try {
      if (action === 'approve') await nexusAPI.approve(id);
      else                      await nexusAPI.reject(id);
      setQueue(prev => prev.filter(a => (a._id ?? a.id) !== id));
      await nexusAPI.getHistory(50).then(h => setHistory(Array.isArray(h) ? h : h?.actions ?? []));
    } catch (e) { setError(e.message); }
    setActing(null);
  };

  const pending = queue.length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Nexus Action Queue</h1>
          {pending > 0 && <span className={styles.pendingBadge}>{pending} pending</span>}
        </div>
        <div className={styles.agentStatus}>
          <StatusDot status={agentUp === null ? 'idle' : agentUp ? 'online' : 'offline'} />
          <span className={styles.agentLabel}>{agentUp === null ? 'Checking…' : agentUp ? 'Agent Online' : 'Agent Offline'}</span>
          <button className={styles.refreshBtn} onClick={loadQueue} disabled={loading}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t === 'queue' ? `Queue${pending > 0 ? ` (${pending})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* Queue Tab */}
      {tab === 'queue' && (
        <div className={styles.queueList}>
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className={styles.skeletonCard} />)
          ) : queue.length === 0 ? (
            <div className={styles.empty}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p>No pending actions — queue is clear</p>
            </div>
          ) : queue.map(item => {
            const id  = item._id ?? item.id;
            const sev = item.severity ?? item.priority ?? 'medium';
            return (
              <div key={id} className={styles.queueCard}>
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <SeverityBadge level={sev} />
                    <span className={styles.actionType}>{item.action ?? item.type ?? 'Unknown Action'}</span>
                  </div>
                  <span className={styles.cardTime}>{timeStr(item.createdAt ?? item.timestamp)}</span>
                </div>
                {item.reason && <p className={styles.cardReason}>{item.reason}</p>}
                <div className={styles.cardMeta}>
                  {item.targetIP && <span className={styles.metaChip}>IP: {item.targetIP}</span>}
                  {item.sourceIP && <span className={styles.metaChip}>Src: {item.sourceIP}</span>}
                  {item.attackId && <span className={styles.metaChip}>Attack: {item.attackId}</span>}
                </div>
                {item.confidence != null && (
                  <div className={styles.confidenceBar}>
                    <span className={styles.confLabel}>Confidence</span>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${Math.round(item.confidence * 100)}%` }} />
                    </div>
                    <span className={styles.confValue}>{Math.round(item.confidence * 100)}%</span>
                  </div>
                )}
                <div className={styles.cardActions}>
                  <button
                    className={styles.approveBtn}
                    onClick={() => decide(id, 'approve')}
                    disabled={acting === id + 'approve'}
                  >
                    {acting === id + 'approve' ? '…' : '✓ Approve'}
                  </button>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => decide(id, 'reject')}
                    disabled={acting === id + 'reject'}
                  >
                    {acting === id + 'reject' ? '…' : '✕ Reject'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Action</th><th>Target</th><th>Decision</th><th>By</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5}><div className={styles.empty}><p>No history yet</p></div></td></tr>
              ) : history.map((h, i) => (
                <tr key={h._id ?? h.id ?? i}>
                  <td className={styles.histAction}>{h.action ?? h.type ?? '—'}</td>
                  <td className={styles.histMono}>{h.targetIP ?? h.sourceIP ?? '—'}</td>
                  <td>
                    <span className={h.decision === 'approved' ? styles.decApproved : styles.decRejected}>
                      {h.decision ?? '—'}
                    </span>
                  </td>
                  <td className={styles.histMono}>{h.decidedBy ?? h.approvedBy ?? h.rejectedBy ?? '—'}</td>
                  <td className={styles.histMono}>{timeStr(h.decidedAt ?? h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
