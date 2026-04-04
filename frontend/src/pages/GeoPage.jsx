import { useState, useEffect, useCallback } from 'react';
import { ipAPI } from '../services/api';
import { connectSocket, disconnectSocket, SOCKET_EVENTS } from '../services/socket';

const SEV_COLOR = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
};

function normalise(raw) {
  // Accept both API shape and socket push shape
  return {
    id:       raw._id   ?? raw.id    ?? Math.random().toString(36).slice(2),
    ip:       raw.srcIP ?? raw.src_ip ?? raw.ip       ?? '0.0.0.0',
    country:  raw.country  ?? raw.geo?.country  ?? 'Unknown',
    city:     raw.city     ?? raw.geo?.city     ?? '—',
    type:     raw.attackType ?? raw.type        ?? 'Unknown',
    severity: (raw.severity ?? 'LOW').toUpperCase(),
    count:    raw.count ?? raw.eventCount ?? 1,
    flag:     raw.flag  ?? '',
  };
}

export default function GeoPage() {
  const [attacks,  setAttacks]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  // ── Initial load from API
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [threats, topSrc] = await Promise.all([
        ipAPI.getGeoThreats().catch(() => []),
        ipAPI.getTopSources().catch(() => []),
      ]);
      const raw = Array.isArray(threats) ? threats
        : threats?.data ?? threats?.threats ?? [];
      setAttacks(raw.map(normalise));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Real-time: new geo event pushed by backend
  useEffect(() => {
    const socket = connectSocket();

    const onGeoEvent = (event) => {
      const item = normalise(event);
      setAttacks(prev => {
        // If same IP already exists, increment its count
        const idx = prev.findIndex(a => a.ip === item.ip);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], count: updated[idx].count + 1 };
          return updated;
        }
        // New IP — prepend, cap at 100 rows
        return [item, ...prev].slice(0, 100);
      });
    };

    socket.on(SOCKET_EVENTS.GEO_EVENT, onGeoEvent);

    return () => {
      socket.off(SOCKET_EVENTS.GEO_EVENT, onGeoEvent);
      disconnectSocket();
    };
  }, []);

  const totals = {
    critical:  attacks.filter(a => a.severity === 'CRITICAL').length,
    high:      attacks.filter(a => a.severity === 'HIGH').length,
    total:     attacks.reduce((s, a) => s + a.count, 0),
    countries: new Set(attacks.map(a => a.country)).size,
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'inherit', color: 'var(--color-text, #e2e8f0)' }}>

      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          Geo Threat Map
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)' }}>
          Live attack origins &amp; IP geolocation intelligence
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Events', value: loading ? '⋯' : totals.total,     color: '#60a5fa' },
          { label: 'Countries',    value: loading ? '⋯' : totals.countries, color: '#a78bfa' },
          { label: 'Critical',     value: loading ? '⋯' : totals.critical,  color: '#ef4444' },
          { label: 'High',         value: loading ? '⋯' : totals.high,      color: '#f97316' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '0.5rem',
            padding: '1rem',
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: '0.25rem' }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Map Placeholder */}
      <div style={{
        background: 'var(--color-surface, #1e293b)',
        border: '1px solid var(--color-border, #334155)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        minHeight: '220px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '0.75rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6">
          <circle cx="12" cy="12" r="9"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          <circle cx="12" cy="12" r="3" fill="#3b82f6" fillOpacity="0.3"/>
        </svg>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)', textAlign: 'center' }}>
          Interactive world map — Leaflet.js integration coming in Stage 3
        </p>
        {/* Live country chips from real data */}
        {attacks.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[...new Map(attacks.map(a => [a.country, a])).values()].slice(0, 12).map(a => (
              <span
                key={a.country}
                onClick={() => setSelected(a)}
                style={{
                  fontSize: '0.7rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  background: SEV_COLOR[a.severity] + '22',
                  border: `1px solid ${SEV_COLOR[a.severity]}44`,
                  color: SEV_COLOR[a.severity],
                  cursor: 'pointer',
                }}>
                {a.flag} {a.country}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Attack Feed Table */}
      <div style={{
        background: 'var(--color-surface, #1e293b)',
        border: '1px solid var(--color-border, #334155)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border, #334155)', fontWeight: 600, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Attack Origins Feed</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted,#94a3b8)' }}>
            {loading ? 'Loading…' : `${attacks.length} sources`}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-offset, rgba(0,0,0,0.2))' }}>
                {['IP Address', 'Location', 'Attack Type', 'Severity', 'Events'].map(h => (
                  <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', color: 'var(--color-text-muted, #94a3b8)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((_, j) => (
                      <td key={j} style={{ padding: '0.625rem 1rem' }}>
                        <div style={{ height: '0.875rem', borderRadius: '0.25rem', background: 'var(--color-surface-offset,#1e2a3a)', width: j === 0 ? '8rem' : '5rem' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : attacks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted,#94a3b8)' }}>
                    No geo events yet
                  </td>
                </tr>
              ) : attacks.map((a, i) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  style={{
                    borderTop: '1px solid var(--color-border, #334155)',
                    cursor: 'pointer',
                    background: selected?.id === a.id
                      ? 'rgba(59,130,246,0.07)'
                      : i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    transition: 'background 120ms',
                  }}>
                  <td style={{ padding: '0.625rem 1rem', fontFamily: 'monospace', color: '#60a5fa' }}>{a.ip}</td>
                  <td style={{ padding: '0.625rem 1rem' }}>{a.flag} {a.city}, {a.country}</td>
                  <td style={{ padding: '0.625rem 1rem', color: 'var(--color-text-muted, #94a3b8)' }}>{a.type}</td>
                  <td style={{ padding: '0.625rem 1rem' }}>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
                      background: (SEV_COLOR[a.severity] ?? '#94a3b8') + '22',
                      color: SEV_COLOR[a.severity] ?? '#94a3b8',
                      fontWeight: 600, letterSpacing: '0.05em',
                    }}>{a.severity}</span>
                  </td>
                  <td style={{ padding: '0.625rem 1rem', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{
          background: 'var(--color-surface, #1e293b)',
          border: `1px solid ${(SEV_COLOR[selected.severity] ?? '#60a5fa')}55`,
          borderRadius: '0.75rem',
          padding: '1.25rem',
          animation: 'fadeIn 150ms ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#60a5fa', fontFamily: 'monospace' }}>{selected.ip}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)', marginTop: '0.2rem' }}>
                {selected.flag} {selected.city}, {selected.country} — {selected.type}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close detail"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted, #94a3b8)', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>
              ×
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
            {[
              { label: 'Severity',    value: selected.severity },
              { label: 'Event Count', value: selected.count },
              { label: 'Attack Type', value: selected.type },
              { label: 'Country',     value: `${selected.flag} ${selected.country}` },
            ].map(f => (
              <div key={f.label} style={{ fontSize: '0.8125rem' }}>
                <div style={{ color: 'var(--color-text-muted, #94a3b8)', marginBottom: '0.2rem', fontSize: '0.75rem' }}>{f.label}</div>
                <div style={{ fontWeight: 600 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
