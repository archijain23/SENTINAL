/**
 * ServiceHealthStrip — Live wired to Gateway API
 *
 * Data sources:
 *   healthAPI.serviceStatus()     → initial poll on mount
 *   Socket: SERVICE_STATUS event  → real-time updates pushed by server
 *
 * Falls back to last known state if API is unreachable.
 * Auto-polls every 30 seconds as a safety net.
 */
import { useState, useEffect, useRef } from 'react';
import { healthAPI } from '../../services/api';
import { getSocket, SOCKET_EVENTS } from '../../services/socket';

// Fallback shape while loading
const FALLBACK_SERVICES = [
  { name: 'Detection Engine', status: 'unknown', latency: null },
  { name: 'PCAP Processor',   status: 'unknown', latency: null },
  { name: 'Nexus AI Agent',   status: 'unknown', latency: null },
  { name: 'Response Engine',  status: 'unknown', latency: null },
  { name: 'API Gateway',      status: 'unknown', latency: null },
];

const STATUS_CONFIG = {
  online:   { color: '#00FF88', bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.18)',  label: 'ONLINE'   },
  degraded: { color: '#FFB800', bg: 'rgba(255,184,0,0.08)',  border: 'rgba(255,184,0,0.2)',   label: 'DEGRADED' },
  offline:  { color: '#FF3D71', bg: 'rgba(255,61,113,0.08)', border: 'rgba(255,61,113,0.2)',  label: 'OFFLINE'  },
  unknown:  { color: '#3D4663', bg: 'rgba(61,70,99,0.08)',   border: 'rgba(61,70,99,0.25)',   label: 'CHECKING' },
};

/** Normalise the API response into a flat array of service objects */
function normalise(raw) {
  if (!raw) return FALLBACK_SERVICES;

  // Server may return { services: [...] } or { data: { services: [...] } } or plain array
  const list =
    raw?.data?.services ??
    raw?.services ??
    (Array.isArray(raw?.data) ? raw.data : null) ??
    (Array.isArray(raw) ? raw : null);

  if (!list) return FALLBACK_SERVICES;

  return list.map(s => ({
    name:    s.name    ?? s.service ?? 'Unknown',
    status:  s.status  ?? 'unknown',
    latency: s.latency ?? s.responseTime ?? null,
    port:    s.port    ?? null,
  }));
}

export default function ServiceHealthStrip() {
  const [services, setServices] = useState(FALLBACK_SERVICES);
  const [loading, setLoading]   = useState(true);
  const intervalRef             = useRef(null);

  async function fetchStatus() {
    try {
      const res = await healthAPI.serviceStatus();
      setServices(normalise(res));
    } catch {
      // silently keep last known state on network error
    } finally {
      setLoading(false);
    }
  }

  // Initial load + 30-second polling interval
  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 30_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Real-time socket push — server broadcasts on service state changes
  useEffect(() => {
    const socket = getSocket();
    socket.on(SOCKET_EVENTS.SERVICE_STATUS, (data) => {
      setServices(normalise(data));
    });
    return () => socket.off(SOCKET_EVENTS.SERVICE_STATUS);
  }, []);

  return (
    <section aria-label="Service health">
      <p className="text-[9px] font-mono tracking-widest uppercase mb-3" style={{ color: '#3D4663' }}>SERVICE HEALTH</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {services.map((svc, i) => {
          const cfg = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.unknown;
          return (
            <div
              key={svc.name ?? i}
              className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: '#0D1117', border: `1px solid ${cfg.border}` }}
            >
              <div>
                <p className="text-[10px] font-mono" style={{ color: '#E2E8F0' }}>{svc.name}</p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: '#3D4663' }}>
                  {svc.port ? `:${svc.port} · ` : ''}
                  {loading ? '…' : svc.latency ? `${svc.latency}ms` : '—'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: cfg.color,
                    boxShadow:  `0 0 6px ${cfg.color}`,
                    animation:  svc.status === 'online' ? 'livePulse 2s ease-in-out infinite' : 'none',
                  }}
                />
                <span className="text-[8px] font-mono tracking-widest" style={{ color: cfg.color }}>
                  {loading ? '⋯' : cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
