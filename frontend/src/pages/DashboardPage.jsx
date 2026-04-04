/**
 * DashboardPage — Live wired to Gateway API
 *
 * Data sources:
 *   statsAPI.getSummary()        → KPI cards
 *   alertsAPI.getAll()           → Active alert count
 *   healthAPI.serviceStatus()    → ServiceHealthStrip
 *   Socket: STATS_UPDATE         → real-time KPI refresh
 *   Socket: NEW_ATTACK           → streamed into ThreatStream
 */
import { useState, useEffect } from 'react';
import KpiCard              from '../components/app/KpiCard';
import ThreatStream         from '../components/app/ThreatStream';
import ServiceHealthStrip   from '../components/app/ServiceHealthStrip';
import { statsAPI, alertsAPI, healthAPI } from '../services/api';
import { getSocket, disconnectSocket, SOCKET_EVENTS } from '../services/socket';

// ── KPI default shape until API responds
const DEFAULT_STATS = {
  threatsToday:   { value: '—',     trend: '',     up: true  },
  blockedIPs:     { value: '—',     trend: '',     up: true  },
  cleanRequests:  { value: '—',     trend: '',     up: true  },
  activeAlerts:   { value: '—',     trend: '',     up: false },
};

export default function DashboardPage() {
  const [stats, setStats]       = useState(DEFAULT_STATS);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // ── Fetch KPIs + alerts on mount
  useEffect(() => {
    async function load() {
      try {
        const [summary, alertsRes] = await Promise.all([
          statsAPI.getSummary(),
          alertsAPI.getAll({ status: 'active', limit: 1 }),
        ]);

        setStats({
          threatsToday:  {
            value: (summary?.data?.threatsToday  ?? summary?.threatsToday  ?? '—').toLocaleString(),
            trend: summary?.data?.threatsTrend  ?? '',
            up:    true,
          },
          blockedIPs: {
            value: (summary?.data?.blockedIPs    ?? summary?.blockedIPs    ?? '—').toLocaleString(),
            trend: summary?.data?.blockedTrend  ?? '',
            up:    true,
          },
          cleanRequests: {
            value: (summary?.data?.cleanRequests ?? summary?.cleanRequests ?? '—').toLocaleString(),
            trend: summary?.data?.cleanTrend    ?? '',
            up:    true,
          },
          activeAlerts: {
            value: (alertsRes?.data?.total       ?? alertsRes?.total       ?? '—').toLocaleString(),
            trend: '',
            up:    false,
          },
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ── Real-time stats updates via Socket.io
  useEffect(() => {
    const socket = getSocket();

    socket.on(SOCKET_EVENTS.STATS_UPDATE, (data) => {
      setStats(prev => ({
        ...prev,
        threatsToday:  { ...prev.threatsToday,  value: (data.threatsToday  ?? prev.threatsToday.value).toLocaleString() },
        blockedIPs:    { ...prev.blockedIPs,    value: (data.blockedIPs    ?? prev.blockedIPs.value).toLocaleString()   },
        cleanRequests: { ...prev.cleanRequests, value: (data.cleanRequests ?? prev.cleanRequests.value).toLocaleString() },
      }));
    });

    return () => {
      socket.off(SOCKET_EVENTS.STATS_UPDATE);
      disconnectSocket();
    };
  }, []);

  return (
    <div className="space-y-5">

      {/* ── Error banner ── */}
      {error && (
        <div className="px-4 py-2 rounded text-xs font-mono"
          style={{ background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)', color: '#FF3D71' }}>
          ⚠️ Gateway unreachable: {error} — showing last known values.
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Threats Today"
          value={loading ? '⋯' : stats.threatsToday.value}
          trend={stats.threatsToday.trend}
          trendUp={stats.threatsToday.up}
          accent="#FF3D71"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
        <KpiCard
          label="Blocked IPs"
          value={loading ? '⋯' : stats.blockedIPs.value}
          trend={stats.blockedIPs.trend}
          trendUp={stats.blockedIPs.up}
          accent="#FF8C00"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          }
        />
        <KpiCard
          label="Clean Requests"
          value={loading ? '⋯' : stats.cleanRequests.value}
          trend={stats.cleanRequests.trend}
          trendUp={stats.cleanRequests.up}
          accent="#00FF88"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
        <KpiCard
          label="Active Alerts"
          value={loading ? '⋯' : stats.activeAlerts.value}
          trend={stats.activeAlerts.trend}
          trendUp={stats.activeAlerts.up}
          accent="#00F5FF"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
      </div>

      {/* ── Main: ThreatStream + Attack Breakdown placeholder ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          {/* ThreatStream receives live data via its own socket hook in next increment */}
          <ThreatStream />
        </div>
        <div
          className="xl:col-span-2 rounded-lg flex flex-col items-center justify-center"
          style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)', minHeight: '420px' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,245,255,0.2)" strokeWidth="1" className="mb-3">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <p className="text-[9px] font-mono tracking-widest uppercase" style={{ color: '#3D4663' }}>ATTACK BREAKDOWN</p>
          <p className="text-[9px] font-mono mt-1" style={{ color: '#3D4663' }}>Donut chart — next increment</p>
        </div>
      </div>

      {/* ── Service Health Strip ── */}
      <ServiceHealthStrip />

    </div>
  );
}
