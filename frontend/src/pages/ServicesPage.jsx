import { useState, useEffect, useCallback } from 'react';
import { healthAPI } from '../services/api';
import { connectSocket, disconnectSocket, SOCKET_EVENTS } from '../services/socket';
import StatusDot from '../components/ui/StatusDot';
import styles from './ServicesPage.module.css';

const SERVICE_META = {
  'gateway':          { label: 'API Gateway',       port: 3000,  desc: 'Main entry point, routing & auth' },
  'detection-engine': { label: 'Detection Engine',  port: 5001,  desc: 'ML classifier & rule matching' },
  'response-engine':  { label: 'Response Engine',   port: 5002,  desc: 'Automated remediation actions' },
  'nexus-agent':      { label: 'Nexus AI Agent',    port: 5003,  desc: 'Gemini-powered decision engine' },
  'pcap-processor':   { label: 'PCAP Processor',    port: 5004,  desc: 'Packet capture analysis' },
  'mongodb':          { label: 'MongoDB',           port: 27017, desc: 'Primary data store' },
  'redis':            { label: 'Redis',             port: 6379,  desc: 'Cache & pub/sub' },
};

function uptime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ServicesPage() {
  const [services,  setServices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [lastCheck, setLastCheck] = useState(null);

  // ── Initial + manual refresh load
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await healthAPI.serviceStatus();
      const list = Array.isArray(data)
        ? data
        : data?.services ?? Object.entries(data ?? {}).map(([k, v]) => ({ name: k, ...v }));
      setServices(list);
      setLastCheck(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // ── Real-time: SERVICE_STATUS + HEALTH_UPDATE from backend
  useEffect(() => {
    const socket = connectSocket();

    // SERVICE_STATUS: a single service changed state
    // payload: { name, status, uptime?, latency?, lastError? }
    const onServiceStatus = (update) => {
      setServices(prev => prev.map(s =>
        (s.name === update.name || s.service === update.name)
          ? { ...s, ...update }
          : s
      ));
      setLastCheck(new Date());
    };

    // HEALTH_UPDATE: full snapshot of all services
    // payload: { services: [...] } or [...]
    const onHealthUpdate = (payload) => {
      const list = Array.isArray(payload)
        ? payload
        : payload?.services ?? [];
      if (list.length > 0) {
        setServices(list);
        setLastCheck(new Date());
      }
    };

    socket.on(SOCKET_EVENTS.SERVICE_STATUS, onServiceStatus);
    socket.on(SOCKET_EVENTS.HEALTH_UPDATE,  onHealthUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.SERVICE_STATUS, onServiceStatus);
      socket.off(SOCKET_EVENTS.HEALTH_UPDATE,  onHealthUpdate);
      disconnectSocket();
    };
  }, []);

  const online   = services.filter(s => s.status === 'online'   || s.status === 'healthy').length;
  const degraded = services.filter(s => s.status === 'degraded').length;
  const offline  = services.filter(s => s.status === 'offline'  || s.status === 'down').length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Service Health</h1>
          {lastCheck && (
            <p className={styles.lastCheck}>Last checked: {lastCheck.toLocaleTimeString()}</p>
          )}
        </div>
        <div className={styles.summary}>
          <span className={styles.sumOnline}>{online} online</span>
          {degraded > 0 && <span className={styles.sumDegraded}>{degraded} degraded</span>}
          {offline  > 0 && <span className={styles.sumOffline}>{offline} offline</span>}
          <button className={styles.refreshBtn} onClick={load} disabled={loading} aria-label="Refresh services">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className={styles.cardGrid}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
        </div>
      ) : services.length === 0 ? (
        <div className={styles.empty}>
          <p>No service data available. Is the gateway running?</p>
          <button className={styles.refreshBtn} onClick={load}>Retry</button>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {services.map((svc, i) => {
            const key  = svc.name ?? svc.service ?? `svc-${i}`;
            const meta = SERVICE_META[key] ?? {};
            const stat = svc.status ?? 'unknown';
            const dotStatus =
              stat === 'healthy'  || stat === 'online'  ? 'online'
              : stat === 'degraded'                     ? 'degraded'
              : stat === 'offline' || stat === 'down'   ? 'offline'
              : 'idle';

            return (
              <div key={key} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardName}>
                    <StatusDot status={dotStatus} />
                    <span>{meta.label ?? key}</span>
                  </div>
                  <span className={`${styles.statusPill} ${styles['status_' + dotStatus]}`}>
                    {stat}
                  </span>
                </div>
                <p className={styles.cardDesc}>{meta.desc ?? svc.description ?? ''}</p>
                <div className={styles.cardMeta}>
                  {meta.port          && <span className={styles.metaChip}>:{meta.port}</span>}
                  {svc.uptime  != null && <span className={styles.metaChip}>↑ {uptime(svc.uptime)}</span>}
                  {svc.latency != null && <span className={styles.metaChip}>{svc.latency}ms</span>}
                  {svc.version        && <span className={styles.metaChip}>v{svc.version}</span>}
                </div>
                {svc.lastError && (
                  <p className={styles.lastError}>⚠ {svc.lastError}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
