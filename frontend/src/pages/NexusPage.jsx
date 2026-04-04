import { useState, useEffect, useCallback, useRef } from 'react';
import { nexusAPI, healthAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusDot     from '../components/ui/StatusDot';
import styles        from './NexusPage.module.css';

const TABS = ['queue', 'history'];

function timeStr(ts) {
  if (!ts) return '\u2014';
  return new Date(ts).toLocaleString();
}

function timeAgo(ts) {
  if (!ts) return '';
  const secs = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

/**
 * Derive a display-friendly action item from a raw attack:new socket payload.
 * Used as fallback when the REST endpoint (Response Engine) is unreachable.
 */
function attackToQueueItem(attack) {
  return {
    _id:       attack._id ?? attack.id ?? attack.attackId ?? `live-${Date.now()}`,
    action:    `Block ${attack.attackType ?? 'attack'}`,
    type:      attack.attackType ?? 'unknown',
    severity:  attack.severity   ?? 'medium',
    confidence: attack.confidence ?? null,
    targetIP:  attack.ip         ?? attack.sourceIP ?? null,
    sourceIP:  attack.ip         ?? null,
    attackId:  attack._id        ?? attack.attackId ?? null,
    reason:    attack.message    ?? `Auto-queued from live ${attack.attackType ?? 'attack'} event`,
    createdAt: attack.timestamp  ?? attack.createdAt ?? new Date().toISOString(),
    _fromSocket: true,   // mark so we know REST didn't confirm it yet
  };
}

export default function NexusPage() {
  const [tab,        setTab]       = useState('queue');
  const [queue,      setQueue]     = useState([]);
  const [history,    setHistory]   = useState([]);
  const [connState,  setConnState] = useState('connecting'); // 'connecting' | 'connected' | 'error'
  const [agentUp,    setAgentUp]   = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [acting,     setActing]    = useState(null);
  const [error,      setError]     = useState(null);
  const restFailed = useRef(false);   // true when /api/actions/pending 404/5xx'd

  /* ── load from REST ─────────────────────────────────────────────────── */
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, h] = await Promise.all([
        nexusAPI.getPending(),
        nexusAPI.getHistory(50),
      ]);
      restFailed.current = false;
      setQueue(Array.isArray(q) ? q : q?.actions ?? []);
      setHistory(Array.isArray(h) ? h : h?.actions ?? []);
    } catch (e) {
      restFailed.current = true;
      // Don't show error banner — socket fallback will populate the queue.
      // Only set a soft warning so the user knows REST is degraded.
      setError('Response Engine offline — showing live socket events only.');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── check gateway health (not microservice list) ───────────────────── */
  useEffect(() => {
    loadQueue();
    healthAPI.get()
      .then(res => {
        // Gateway /api/health returns { status: 'ok' | 'degraded' | 'error' }
        // We're connected to the gateway if we got any response at all.
        setConnState('connected');
        const status = res?.status ?? 'ok';
        // agentUp = the response-engine microservice is available
        // Try to detect from services array if present, otherwise infer from REST success
        const svcs = res?.services ?? [];
        if (svcs.length > 0) {
          const nx = svcs.find(s =>
            /nexus|response.engine|sentinal.response/i.test(s.name ?? s.service ?? '')
          );
          setAgentUp(nx ? (nx.status === 'online' || nx.status === 'healthy') : !restFailed.current);
        } else {
          // Gateway responded — agent is "up" if REST also succeeded
          setAgentUp(!restFailed.current);
        }
      })
      .catch(() => {
        setConnState('error');
        setAgentUp(false);
      });
  }, [loadQueue]);

  /* ── socket: queue updates + action decisions + attack fallback ──────── */
  useEffect(() => {
    // Use getSocket() — does NOT disconnect on unmount, singleton persists
    const socket = getSocket();

    // Track connection state in UI
    const onConnect    = () => setConnState('connected');
    const onDisconnect = () => setConnState('connecting');
    const onError      = () => setConnState('error');

    // Existing queue item updated (status change, re-prioritised, etc.)
    const onQueueUpdate = (item) => {
      setQueue(prev => {
        const exists = prev.find(a => (a._id ?? a.id) === (item._id ?? item.id));
        if (exists)
          return prev.map(a =>
            (a._id ?? a.id) === (item._id ?? item.id) ? { ...a, ...item } : a
          );
        return [item, ...prev];
      });
    };

    // Action approved / rejected by another operator or auto-responder
    const onActionDecision = ({ id, decision }) => {
      setQueue(prev => prev.filter(a => (a._id ?? a.id) !== id));
      nexusAPI.getHistory(50)
        .then(h => setHistory(Array.isArray(h) ? h : h?.actions ?? []))
        .catch(() => {});
    };

    /**
     * FALLBACK: when the Response Engine REST endpoint is down,
     * synthesise a pending queue item from every incoming attack:new event.
     * Items marked _fromSocket are shown with a dim "live" badge.
     */
    const onNewAttack = (attack) => {
      if (!restFailed.current) return;  // REST is fine — don't double-add
      const item = attackToQueueItem(attack);
      setQueue(prev => {
        // Deduplicate by attackId
        const already = prev.find(a =>
          (a.attackId && a.attackId === item.attackId) ||
          (a._id && a._id === item._id)
        );
        if (already) return prev;
        return [item, ...prev].slice(0, 100);
      });
    };

    socket.on('connect',                    onConnect);
    socket.on('disconnect',                 onDisconnect);
    socket.on('connect_error',              onError);
    socket.on(SOCKET_EVENTS.QUEUE_UPDATE,   onQueueUpdate);
    socket.on(SOCKET_EVENTS.ACTION_DECISION, onActionDecision);
    socket.on(SOCKET_EVENTS.NEW_ATTACK,     onNewAttack);

    // Set initial state from current socket connection
    if (socket.connected) setConnState('connected');

    return () => {
      // Only remove THIS page's listeners — DO NOT call disconnectSocket().
      // The singleton socket is shared across the whole app.
      socket.off('connect',                    onConnect);
      socket.off('disconnect',                 onDisconnect);
      socket.off('connect_error',              onError);
      socket.off(SOCKET_EVENTS.QUEUE_UPDATE,   onQueueUpdate);
      socket.off(SOCKET_EVENTS.ACTION_DECISION, onActionDecision);
      socket.off(SOCKET_EVENTS.NEW_ATTACK,     onNewAttack);
    };
  }, []);

  /* ── approve / reject ───────────────────────────────────────────────── */
  const decide = async (id, action) => {
    setActing(id + action);
    try {
      if (action === 'approve') await nexusAPI.approve(id);
      else                      await nexusAPI.reject(id);
      setQueue(prev => prev.filter(a => (a._id ?? a.id) !== id));
      const h = await nexusAPI.getHistory(50);
      setHistory(Array.isArray(h) ? h : h?.actions ?? []);
    } catch (e) {
      // If REST is down, just remove from local queue (optimistic)
      setQueue(prev => prev.filter(a => (a._id ?? a.id) !== id));
    }
    setActing(null);
  };

  const pending = queue.length;

  /* ── connection indicator ───────────────────────────────────────────── */
  const connLabel = {
    connecting: 'Connecting…',
    connected:  'Gateway Connected',
    error:      'Connection Error',
  }[connState];
  const connStatus = {
    connecting: 'idle',
    connected:  'online',
    error:      'offline',
  }[connState];

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Action Queue</h1>
          {pending > 0 && (
            <span className={styles.pendingBadge}>
              {pending} pending
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          {/* Socket / gateway connection */}
          <div className={styles.connPill}>
            <StatusDot status={connStatus} />
            <span className={styles.connLabel}>{connLabel}</span>
          </div>
          {/* Nexus agent / response engine */}
          <div className={styles.agentStatus}>
            <StatusDot status={agentUp === null ? 'idle' : agentUp ? 'online' : 'offline'} />
            <span className={styles.agentLabel}>
              {agentUp === null
                ? 'Agent checking…'
                : agentUp
                ? 'Response Engine Online'
                : 'Response Engine Offline'}
            </span>
          </div>
          <button className={styles.refreshBtn} onClick={loadQueue} disabled={loading} title="Reload queue">
            <RefreshIcon spin={loading} />
          </button>
        </div>
      </div>

      {/* ── soft warning banner (REST degraded, not hard error) ── */}
      {error && (
        <div className={styles.warnBanner}>
          <span className={styles.warnIcon}>⚡</span>
          {error}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'queue'
              ? <>Queue {pending > 0 && <span className={styles.tabBadge}>{pending}</span>}</>
              : 'History'
            }
          </button>
        ))}
      </div>

      {/* ══ Queue Tab ══════════════════════════════════════════════════ */}
      {tab === 'queue' && (
        <div className={styles.queueList}>
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)
          ) : queue.length === 0 ? (
            <div className={styles.empty}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1" opacity="0.25">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p>Queue is clear — no pending actions</p>
              {restFailed.current && (
                <span className={styles.emptyHint}>
                  Waiting for live events from socket…
                </span>
              )}
            </div>
          ) : (
            queue.map(item => {
              const id  = item._id ?? item.id;
              const sev = item.severity ?? item.priority ?? 'medium';
              return (
                <div
                  key={id}
                  className={`${styles.queueCard} ${item._fromSocket ? styles.queueCardLive : ''}`}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.cardLeft}>
                      <SeverityBadge level={sev} />
                      <span className={styles.actionType}>
                        {item.action ?? item.type ?? 'Unknown Action'}
                      </span>
                      {item._fromSocket && (
                        <span className={styles.livePill}>LIVE</span>
                      )}
                    </div>
                    <span className={styles.cardTime} title={timeStr(item.createdAt ?? item.timestamp)}>
                      {timeAgo(item.createdAt ?? item.timestamp)}
                    </span>
                  </div>

                  {item.reason && (
                    <p className={styles.cardReason}>{item.reason}</p>
                  )}

                  <div className={styles.cardMeta}>
                    {item.targetIP && <span className={styles.metaChip}>🎯 {item.targetIP}</span>}
                    {item.sourceIP && item.sourceIP !== item.targetIP && (
                      <span className={styles.metaChip}>📡 {item.sourceIP}</span>
                    )}
                    {item.attackId && (
                      <span className={styles.metaChip} title={item.attackId}>
                        Attack #{String(item.attackId).slice(-6)}
                      </span>
                    )}
                  </div>

                  {item.confidence != null && (
                    <div className={styles.confidenceBar}>
                      <span className={styles.confLabel}>Confidence</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{
                            width: `${Math.round(item.confidence * 100)}%`,
                            background: item.confidence > 0.75
                              ? '#22c55e'
                              : item.confidence > 0.4
                              ? '#f97316'
                              : '#ef4444',
                          }}
                        />
                      </div>
                      <span className={styles.confValue}>
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  )}

                  <div className={styles.cardActions}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => decide(id, 'approve')}
                      disabled={!!acting}
                    >
                      {acting === id + 'approve' ? <SpinDot /> : '✓ Approve'}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => decide(id, 'reject')}
                      disabled={!!acting}
                    >
                      {acting === id + 'reject' ? <SpinDot /> : '✕ Reject'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══ History Tab ════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Decision</th>
                <th>By</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles.empty}>
                      <p>{restFailed.current ? 'History unavailable — Response Engine offline' : 'No history yet'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={h._id ?? h.id ?? i}>
                    <td className={styles.histAction}>{h.action ?? h.type ?? '—'}</td>
                    <td className={styles.histMono}>{h.targetIP ?? h.sourceIP ?? '—'}</td>
                    <td>
                      <span className={
                        h.decision === 'approved' ? styles.decApproved : styles.decRejected
                      }>
                        {h.decision ?? '—'}
                      </span>
                    </td>
                    <td className={styles.histMono}>
                      {h.decidedBy ?? h.approvedBy ?? h.rejectedBy ?? '—'}
                    </td>
                    <td className={styles.histMono} title={timeStr(h.decidedAt ?? h.createdAt)}>
                      {timeAgo(h.decidedAt ?? h.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── inline icons ─────────────────────────────────────────────────────── */
function RefreshIcon({ spin }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      style={spin ? { animation: 'spin 0.8s linear infinite' } : {}}
    >
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}
function SpinDot() {
  return (
    <span style={{
      display: 'inline-block', width: '10px', height: '10px',
      border: '2px solid currentColor', borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}
