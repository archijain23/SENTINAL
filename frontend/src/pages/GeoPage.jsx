/**
 * GeoPage — Live World Threat Map
 *
 * Map: react-leaflet v4 + leaflet v1.9 — 2D flat world map
 * Tile layer: CartoDB Dark Matter (free, no API key required)
 *
 * Data flow:
 *   1. GET /api/geo/threats  — all unique IPs with counts + geo (MongoDB-direct)
 *   2. socket 'attack:new'   — real-time updates pushed by gateway
 *
 * All existing functionality preserved:
 *   - KPI cards, attack feed table, detail panel
 *   - Socket live updates
 *   - normalise() data contract
 */
import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { ipAPI }                      from '../services/api';
import { getSocket, SOCKET_EVENTS }   from '../services/socket';

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const T = {
  bg:      '#0D1117',
  surface: '#161B22',
  border:  'rgba(0,245,255,0.10)',
  borderD: 'rgba(0,245,255,0.06)',
  cyan:    '#00F5FF',
  green:   '#00FF88',
  red:     '#FF3D71',
  orange:  '#FF9500',
  yellow:  '#FFD700',
  muted:   '#6B7894',
  text:    '#B8C4E0',
};

const SEV = {
  CRITICAL: { color: '#FF3D71', bg: 'rgba(255,61,113,0.12)',  border: 'rgba(255,61,113,0.30)' },
  HIGH:     { color: '#FF9500', bg: 'rgba(255,149,0,0.12)',   border: 'rgba(255,149,0,0.30)'  },
  MEDIUM:   { color: '#FFD700', bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.30)'  },
  LOW:      { color: '#00FF88', bg: 'rgba(0,255,136,0.10)',   border: 'rgba(0,255,136,0.25)'  },
};
const sevStyle = s => SEV[(s || '').toUpperCase()] ?? SEV.LOW;

/* ── Normalise — handles both /threats shape and socket push ──────────────── */
function normalise(raw) {
  const geo = raw.geoIntel ?? {};
  return {
    id:       raw._id ?? raw.id ?? raw.ip ?? Math.random().toString(36).slice(2),
    ip:       raw.ip ?? raw.srcIP ?? '0.0.0.0',
    country:  raw.country   ?? geo.country   ?? 'Unknown',
    city:     raw.city      ?? geo.city      ?? null,
    lat:      raw.latitude  ?? geo.latitude  ?? raw.lat ?? null,
    lng:      raw.longitude ?? geo.longitude ?? raw.lng ?? null,
    type:     raw.attackType ?? raw.type ?? 'Unknown',
    severity: (raw.severity ?? 'low').toUpperCase(),
    count:    raw.count ?? 1,
    isTor:    raw.is_tor   ?? geo.is_tor   ?? false,
    isProxy:  raw.is_proxy ?? geo.is_proxy ?? false,
    abuseScore: raw.abuse_confidence_score ?? geo.abuse_confidence_score ?? null,
    ts:       raw.lastSeen ?? raw.timestamp ?? new Date().toISOString(),
  };
}

/* ── Radius scales with event count (min 5 px, max 18 px) ─────────────────── */
function dotRadius(count) {
  return Math.min(5 + Math.log2(count + 1) * 2.2, 18);
}

/* ── Shared UI components ─────────────────────────────────────────────────── */
function SevBadge({ sev }) {
  const s = sevStyle(sev);
  return (
    <span style={{
      fontFamily: 'monospace', fontSize: '10px', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: '4px',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
    }}>{sev}</span>
  );
}

function KpiCard({ label, value, color, loading }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: '8px', padding: '14px 18px', minWidth: 0,
    }}>
      <div style={{
        fontFamily: 'monospace', fontWeight: 700, fontSize: '22px', color,
        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        filter: loading ? 'blur(5px)' : 'none', transition: 'filter 0.3s',
      }}>
        {loading ? '000' : value}
      </div>
      <div style={{
        fontFamily: 'monospace', fontSize: '10px', color: T.muted,
        marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.10em',
      }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function GeoPage() {
  const [attacks,  setAttacks]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [live,     setLive]     = useState(false);

  /* ── Load from REST ────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const raw  = await ipAPI.getGeoThreats();
      const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.threats ?? []);
      setAttacks(list.map(normalise));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Real-time socket ──────────────────────────────────────────────────── */
  useEffect(() => {
    const socket  = getSocket();
    const handler = event => {
      setLive(true);
      const item = normalise(event);
      setAttacks(prev => {
        const idx = prev.findIndex(a => a.ip === item.ip);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            count:    next[idx].count + 1,
            severity: item.severity,
            type:     item.type,
            lat: next[idx].lat ?? item.lat,
            lng: next[idx].lng ?? item.lng,
            country: next[idx].country !== 'Unknown' ? next[idx].country : item.country,
            city:    next[idx].city    ?? item.city,
          };
          return next;
        }
        return [item, ...prev].slice(0, 200);
      });
    };
    socket.on(SOCKET_EVENTS.NEW_ATTACK, handler);
    socket.on('geo:event',              handler);
    return () => {
      socket.off(SOCKET_EVENTS.NEW_ATTACK, handler);
      socket.off('geo:event',              handler);
    };
  }, []);

  const handleSelect = useCallback(a => setSelected(p => p?.id === a.id ? null : a), []);

  /* ── Derived stats ─────────────────────────────────────────────────────── */
  const stats = {
    total:     attacks.reduce((s, a) => s + a.count, 0),
    countries: new Set(attacks.map(a => a.country).filter(c => c !== 'Unknown')).size,
    critical:  attacks.filter(a => a.severity === 'CRITICAL').length,
    high:      attacks.filter(a => a.severity === 'HIGH').length,
    tor:       attacks.filter(a => a.isTor || a.isProxy).length,
  };
  const mapped = attacks.filter(a => a.lat != null && a.lng != null);

  return (
    <div style={{ maxWidth: '1200px', fontFamily: 'monospace' }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{
            fontFamily: 'monospace', fontWeight: 700, fontSize: '13px',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            color: T.cyan, margin: 0,
          }}>Geo Threat Map</h1>
          {live && (
            <span style={{
              fontFamily: 'monospace', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: '4px',
              color: '#00FF88', background: 'rgba(0,255,136,0.08)',
              border: '1px solid rgba(0,255,136,0.2)',
            }}>LIVE</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: T.muted }}>
          Live attack origins · IP geolocation · 2D world map
        </p>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '7px', marginBottom: '14px',
          background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.25)',
          fontFamily: 'monospace', fontSize: '11px', color: T.red,
        }}>⚠ {error}</div>
      )}

      {/* ── KPI row ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
        gap: '10px', marginBottom: '16px',
      }}>
        <KpiCard label="Total Events"  value={stats.total}     color={T.cyan}   loading={loading} />
        <KpiCard label="Countries"     value={stats.countries} color="#a78bfa"  loading={loading} />
        <KpiCard label="Critical"      value={stats.critical}  color={T.red}    loading={loading} />
        <KpiCard label="High"          value={stats.high}      color={T.orange} loading={loading} />
        <KpiCard label="TOR / Proxy"   value={stats.tor}       color={T.muted}  loading={loading} />
      </div>

      {/* ── 2D Leaflet Map ─────────────────────────────────────────────────── */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: '10px', overflow: 'hidden', marginBottom: '16px',
      }}>
        {/* Map header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${T.borderD}`,
        }}>
          <span style={{
            fontSize: '11px', color: T.cyan,
            textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>Live Threat Map</span>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {Object.entries(SEV).map(([k, v]) => (
              <span key={k} style={{
                fontSize: '10px', color: v.color,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: v.color, display: 'inline-block',
                }} />{k}
              </span>
            ))}
            <span style={{ fontSize: '10px', color: T.muted }}>
              {mapped.length} dot{mapped.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Leaflet map canvas */}
        <div style={{ height: '460px', width: '100%' }}>
          {!loading && (
            <MapContainer
              center={[20, 0]}
              zoom={2}
              minZoom={2}
              maxZoom={10}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', background: '#0D1117' }}
              maxBounds={[[-90, -180], [90, 180]]}
              maxBoundsViscosity={1.0}
              worldCopyJump={false}
            >
              {/* CartoDB Dark Matter — free, no API key, matches SENTINAL dark theme */}
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                subdomains="abcd"
                maxZoom={19}
              />

              {/* Attack markers */}
              {mapped.map(a => {
                const s = sevStyle(a.severity);
                return (
                  <CircleMarker
                    key={a.id}
                    center={[a.lat, a.lng]}
                    radius={dotRadius(a.count)}
                    pathOptions={{
                      color:       s.color,
                      fillColor:   s.color,
                      fillOpacity: selected?.id === a.id ? 1 : 0.75,
                      weight:      selected?.id === a.id ? 2 : 1,
                      opacity:     1,
                    }}
                    eventHandlers={{
                      click: () => handleSelect(a),
                    }}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -6]}
                      opacity={1}
                      className="sentinal-tooltip"
                    >
                      <div style={{
                        fontFamily: 'monospace', fontSize: '11px',
                        background: 'rgba(13,17,23,0.97)',
                        border: `1px solid ${s.border}`,
                        borderRadius: '6px', padding: '8px 12px',
                        color: T.text, minWidth: '160px',
                      }}>
                        <div style={{ fontWeight: 700, color: s.color, marginBottom: '3px' }}>
                          {a.ip}
                        </div>
                        <div>{a.city ? `${a.city}, ` : ''}{a.country}</div>
                        <div style={{ color: T.muted, marginTop: '2px' }}>
                          {a.type} · {a.severity} · {a.count} event{a.count !== 1 ? 's' : ''}
                        </div>
                        {(a.isTor || a.isProxy) && (
                          <div style={{ marginTop: '3px', display: 'flex', gap: '6px' }}>
                            {a.isTor   && <span style={{ color: T.red,    fontSize: '9px', fontWeight: 700 }}>TOR EXIT</span>}
                            {a.isProxy && <span style={{ color: T.orange, fontSize: '9px', fontWeight: 700 }}>OPEN PROXY</span>}
                          </div>
                        )}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}

          {/* Loading skeleton while data loads */}
          {loading && (
            <div style={{
              height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#0D1117',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: T.muted }}>
                Loading threat data…
              </span>
            </div>
          )}

          {/* Empty state */}
          {!loading && mapped.length === 0 && (
            <div style={{
              position: 'absolute', bottom: '16px', left: '50%',
              transform: 'translateX(-50%)', zIndex: 1000,
              fontFamily: 'monospace', fontSize: '11px', color: T.muted,
              background: 'rgba(13,17,23,0.85)', padding: '6px 14px',
              borderRadius: '6px', pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              No geo-located events — fire an attack on /simulate to populate the map
            </div>
          )}
        </div>
      </div>

      {/* ── Attack origins feed ────────────────────────────────────────────── */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: '10px', overflow: 'hidden', marginBottom: '14px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${T.borderD}`,
        }}>
          <span style={{
            fontSize: '11px', color: T.cyan,
            textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>Attack Origins Feed</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: T.muted }}>
              {loading ? 'Loading…' : `${attacks.length} unique source${attacks.length !== 1 ? 's' : ''}`}
            </span>
            <button
              onClick={load}
              disabled={loading}
              style={{
                fontFamily: 'monospace', fontSize: '10px', color: T.cyan,
                background: 'rgba(0,245,255,0.06)', border: `1px solid ${T.border}`,
                borderRadius: '5px', padding: '3px 10px', cursor: 'pointer',
                opacity: loading ? 0.4 : 1,
              }}
            >↺ Refresh</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '340px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: T.surface, zIndex: 1 }}>
              <tr>
                {['IP Address', 'Location', 'Attack Type', 'Severity', 'Events', 'Flags'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left', color: T.muted,
                    fontWeight: 500, whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${T.borderD}`,
                    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[140, 120, 100, 70, 40, 60].map((w, j) => (
                      <td key={j} style={{ padding: '10px 14px' }}>
                        <div style={{
                          height: '11px', borderRadius: '3px', width: `${w}px`,
                          background: 'rgba(0,245,255,0.05)',
                          animation: 'shimmer 1.5s ease-in-out infinite',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : attacks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: T.muted }}>
                    No attacks recorded yet — fire a simulation on /simulate
                  </td>
                </tr>
              ) : attacks.map(a => (
                <tr
                  key={a.id}
                  onClick={() => handleSelect(a)}
                  style={{
                    borderTop: `1px solid ${T.borderD}`,
                    cursor: 'pointer',
                    background: selected?.id === a.id ? sevStyle(a.severity).bg : 'transparent',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => {
                    if (selected?.id !== a.id) e.currentTarget.style.background = 'rgba(0,245,255,0.02)';
                  }}
                  onMouseLeave={e => {
                    if (selected?.id !== a.id) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ padding: '9px 14px', color: T.cyan }}>{a.ip}</td>
                  <td style={{ padding: '9px 14px', color: T.text }}>
                    {a.city ? `${a.city}, ` : ''}{a.country}
                  </td>
                  <td style={{ padding: '9px 14px', color: T.muted }}>{a.type}</td>
                  <td style={{ padding: '9px 14px' }}><SevBadge sev={a.severity} /></td>
                  <td style={{
                    padding: '9px 14px', color: T.text,
                    fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                  }}>{a.count}</td>
                  <td style={{ padding: '9px 14px', fontSize: '10px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {a.isTor   && <span style={{ color: T.red,    fontWeight: 700 }}>TOR</span>}
                    {a.isProxy && <span style={{ color: T.orange, fontWeight: 700 }}>PROXY</span>}
                    {a.lat != null && <span style={{ color: T.green }} title="Geo-located">●</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Selected IP detail panel ────────────────────────────────────────── */}
      {selected && (
        <div style={{
          background: T.surface,
          border: `1px solid ${sevStyle(selected.severity).border}`,
          borderRadius: '10px', padding: '16px 20px',
          animation: 'slideUp 160ms ease',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: '14px',
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: T.cyan, letterSpacing: '0.04em' }}>
                {selected.ip}
              </div>
              <div style={{ fontSize: '11px', color: T.muted, marginTop: '3px' }}>
                {selected.city ? `${selected.city}, ` : ''}{selected.country}
                {selected.lat != null && ` · ${selected.lat.toFixed(2)}°, ${selected.lng.toFixed(2)}°`}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.muted, fontSize: '18px', lineHeight: 1, padding: '2px 6px',
              }}
              aria-label="Close"
            >×</button>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
            gap: '12px',
          }}>
            {[
              { label: 'Severity',    value: <SevBadge sev={selected.severity} /> },
              { label: 'Attack Type', value: selected.type },
              { label: 'Event Count', value: selected.count },
              { label: 'TOR Exit',    value: selected.isTor   ? '✓ Yes' : '—' },
              { label: 'Open Proxy',  value: selected.isProxy ? '✓ Yes' : '—' },
              { label: 'Abuse Score', value: selected.abuseScore != null ? `${selected.abuseScore}%` : '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{
                  fontSize: '10px', color: T.muted, textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: '4px',
                }}>{f.label}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: T.text }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Global styles ───────────────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

        /* Override Leaflet default tooltip white bubble */
        .sentinal-tooltip .leaflet-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip.sentinal-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        /* Leaflet attribution — keep it minimal and dark */
        .leaflet-control-attribution {
          background: rgba(13,17,23,0.75) !important;
          color: #4a5568 !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a {
          color: #4a5568 !important;
        }

        /* Leaflet zoom controls — dark theme */
        .leaflet-control-zoom a {
          background: #161B22 !important;
          color: #00F5FF !important;
          border-color: rgba(0,245,255,0.15) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(0,245,255,0.08) !important;
        }
      `}</style>
    </div>
  );
}
