/**
 * DashboardPage — /app/dashboard
 *
 * Data sources:
 *   statsAPI.getSummary()  → GET /api/stats
 *     Response shape (from statsService.js):
 *       { totalLogs, totalAttacks, totalAlerts, unreadAlerts,
 *         attacksByType: { [type]: count },
 *         attacksBySeverity: { [severity]: count },
 *         recentAttacks: [ { ip, attackType, severity, status, confidence, createdAt } ] }
 *
 * Real-time updates:
 *   Socket STATS_UPDATE  → re-maps KPI values + re-builds charts
 *   Socket NEW_ATTACK    → ThreatStream handles this independently
 *
 * Socket cleanup:
 *   Only socket.off() on unmount — never disconnectSocket().
 *   The singleton socket must stay alive for all other pages.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import KpiCard             from '../components/app/KpiCard';
import ThreatStream        from '../components/app/ThreatStream';
import ServiceHealthStrip  from '../components/app/ServiceHealthStrip';
import AttackTypeChart     from '../components/dashboard/AttackTypeChart';
import SeverityChart       from '../components/dashboard/SeverityChart';
import ActivitySparkline   from '../components/dashboard/ActivitySparkline';
import { statsAPI, alertsAPI } from '../services/api';
import { getSocket, connectSocket, SOCKET_EVENTS } from '../services/socket';

// ─────────────────────────────────────────────────────────────
// Map raw statsService response → UI shape
// Handles both direct API response and STATS_UPDATE socket payload
// ─────────────────────────────────────────────────────────────
function mapStats(raw) {
  if (!raw) return null;
  // API wraps in { success, data: {...} } — unwrap defensively
  const d = raw?.data ?? raw;
  return {
    totalAttacks:      d?.totalAttacks       ?? 0,
    totalLogs:         d?.totalLogs          ?? 0,
    totalAlerts:       d?.totalAlerts        ?? 0,
    unreadAlerts:      d?.unreadAlerts       ?? 0,
    attacksByType:     d?.attacksByType      ?? {},
    attacksBySeverity: d?.attacksBySeverity  ?? {},
    recentAttacks:     d?.recentAttacks      ?? [],
    // Derived: clean requests = total logs minus attack events
    cleanRequests:     Math.max(0, (d?.totalLogs ?? 0) - (d?.totalAttacks ?? 0)),
  };
}

export default function DashboardPage() {
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [socketLive, setSocketLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const mountedRef = useRef(true);

  // ── Fetch on mount ─────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const raw = await statsAPI.getSummary();
      if (!mountedRef.current) return;
      setStats(mapStats(raw));
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadStats();
    // Connect socket on dashboard mount
    connectSocket();
    return () => { mountedRef.current = false; };
  }, [loadStats]);

  // ── Socket: STATS_UPDATE ────────────────────────────────────
  // CRITICAL: only socket.off() on cleanup — never disconnectSocket()
  useEffect(() => {
    const socket = getSocket();

    const handleStatsUpdate = (data) => {
      if (!mountedRef.current) return;
      setStats(mapStats(data));
      setSocketLive(true);
      setLastUpdate(new Date());
      setError(null);
    };

    const handleConnect    = () => { if (mountedRef.current) setSocketLive(true);  };
    const handleDisconnect = () => { if (mountedRef.current) setSocketLive(false); };

    socket.on(SOCKET_EVENTS.STATS_UPDATE, handleStatsUpdate);
    socket.on('connect',    handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Reflect current connection state immediately
    if (socket.connected) setSocketLive(true);

    // ⚠ ONLY unsubscribe event handlers — never call disconnectSocket() here
    return () => {
      socket.off(SOCKET_EVENTS.STATS_UPDATE, handleStatsUpdate);
      socket.off('connect',    handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  // ── Derived values for KPI cards ───────────────────────────
  const kpi = stats ? {
    totalAttacks:  stats.totalAttacks.toLocaleString(),
    unreadAlerts:  stats.unreadAlerts.toLocaleString(),
    cleanRequests: stats.cleanRequests.toLocaleString(),
    totalLogs:     stats.totalLogs.toLocaleString(),
  } : null;

  // Format last-update time
  const lastUpdateStr = lastUpdate
    ? `${String(lastUpdate.getHours()).padStart(2,'0')}:${String(lastUpdate.getMinutes()).padStart(2,'0')}:${String(lastUpdate.getSeconds()).padStart(2,'0')}`
    : null;

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-mono font-semibold" style={{ color: '#E2E8F0' }}>Security Overview</h1>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: '#3D4663' }}>
            Real-time threat intelligence dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdateStr && (
            <span className="text-[9px] font-mono" style={{ color: '#3D4663' }}>
              updated {lastUpdateStr}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:  socketLive ? '#00FF88' : '#3D4663',
                boxShadow:   socketLive ? '0 0 6px #00FF88' : 'none',
                animation:   socketLive ? 'livePulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <span
              className="text-[9px] font-mono tracking-widest uppercase"
              style={{ color: socketLive ? '#00FF88' : '#3D4663' }}
            >
              {socketLive ? 'LIVE' : 'CONNECTING'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          className="px-4 py-2.5 rounded text-[10px] font-mono flex items-center gap-2"
          style={{
            background: 'rgba(255,61,113,0.06)',
            border: '1px solid rgba(255,61,113,0.2)',
            color: '#FF3D71',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Gateway unreachable — {error}. Showing last known values.
          <button
            onClick={loadStats}
            className="ml-auto text-[9px] font-mono px-2 py-0.5 rounded transition-colors duration-150"
            style={{ background: 'rgba(255,61,113,0.12)', border: '1px solid rgba(255,61,113,0.25)', color: '#FF3D71' }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          loading={loading}
          label="Total Attacks"
          value={kpi?.totalAttacks}
          accent="#FF3D71"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
        <KpiCard
          loading={loading}
          label="Unread Alerts"
          value={kpi?.unreadAlerts}
          trendUp={false}
          accent="#FF8C00"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
        <KpiCard
          loading={loading}
          label="Clean Requests"
          value={kpi?.cleanRequests}
          trendUp={true}
          accent="#00FF88"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
        <KpiCard
          loading={loading}
          label="Total Log Events"
          value={kpi?.totalLogs}
          trendUp={true}
          accent="#00F5FF"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          }
        />
      </div>

      {/* ── Charts Row 1: Attack Breakdown + Severity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AttackTypeChart
          data={stats?.attacksByType}
          loading={loading}
        />
        <SeverityChart
          data={stats?.attacksBySeverity}
          loading={loading}
        />
      </div>

      {/* ── Activity Sparkline (full width) ── */}
      <ActivitySparkline
        attacks={stats?.recentAttacks}
        loading={loading}
        socketLive={socketLive}
      />

      {/* ── Main: ThreatStream ── */}
      <ThreatStream />

      {/* ── Service Health Strip ── */}
      <ServiceHealthStrip />

    </div>
  );
}
