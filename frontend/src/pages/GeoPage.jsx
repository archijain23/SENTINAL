/**
 * GeoPage — Geo-IP Threat Intelligence Map
 * ==========================================
 * Ported from ayushtiwari18/SENTINAL dashboard/src/pages/GeoThreatMap.jsx
 * Adapted for archijain23/SENTINAL: uses existing ipAPI + socket services
 *
 * Map:  react-leaflet v4 + leaflet v1.9  (React 18 compatible)
 * Data: GET /api/geo/heatmap  + GET /api/geo/stats
 * Live: socket 'attack:new' + 'geo:event'
 */

import 'leaflet/dist/leaflet.css';
import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { ipAPI }               from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';

// Fix Leaflet default icon URLs broken by Vite asset hashing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ── Colour + radius by attack count (matches reference implementation) ────── */
function countToColor(count) {
  if (count >= 100) return '#ef4444';
  if (count >= 50)  return '#f97316';
  if (count >= 20)  return '#eab308';
  if (count >= 5)   return '#22c55e';
  return '#3b82f6';
}

function countToRadius(count) {
  if (count >= 100) return 30;
  if (count >= 50)  return 22;
  if (count >= 20)  return 16;
  if (count >= 5)   return 10;
  return 6;
}

/* ── Design tokens (SENTINAL dark theme) ─────────────────────────────── */
const T = {
  bg:      '#0D1117',
  surface: '#161B22',
  surface2:'#1f2937',
  border:  '#374151',
  cyan:    '#2dd4bf',
  text:    '#ffffff',
  muted:   '#9ca3af',
  muted2:  '#d1d5db',
  red:     '#f87171',
  accent:  '#14b8a6',
};

const legend = [
  { color: '#3b82f6', label: '1–4'   },
  { color: '#22c55e', label: '5–19'  },
  { color: '#eab308', label: '20–49' },
  { color: '#f97316', label: '50–99' },
  { color: '#ef4444', label: '100+'  },
];

/* ══════════════════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function GeoPage() {
  const [heatmap, setHeatmap] = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [live,    setLive]    = useState(false);

  /* ── Fetch heatmap + stats ───────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use existing ipAPI service — falls back gracefully if endpoints differ
      const [heatRes, statsRes] = await Promise.all([
        ipAPI.getGeoHeatmap  ? ipAPI.getGeoHeatmap()  : ipAPI.getGeoThreats(),
        ipAPI.getGeoStats    ? ipAPI.getGeoStats()    : Promise.resolve(null),
      ]);

      // Normalise heatmap: support both {heatmap:[]} and flat array shapes
      const raw = Array.isArray(heatRes)
        ? heatRes
        : (heatRes?.heatmap ?? heatRes?.data ?? heatRes?.threats ?? []);
      setHeatmap(raw);

      // Normalise stats
      const statsRaw = statsRes?.data ?? statsRes ?? null;
      setStats(statsRaw);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Real-time socket — on new attack, bump the matching country count ───── */
  useEffect(() => {
    const socket  = getSocket();
    const handler = () => {
      setLive(true);
      // Re-fetch to keep heatmap accurate (socket gives per-IP, not per-country)
      fetchData();
    };
    socket.on(SOCKET_EVENTS.NEW_ATTACK, handler);
    socket.on('geo:event',              handler);
    return () => {
      socket.off(SOCKET_EVENTS.NEW_ATTACK, handler);
      socket.off('geo:event',              handler);
    };
  }, [fetchData]);

  /* ── Loading state ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '24rem', color: T.muted,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem', height: '3rem', borderRadius: '50%',
            border: `3px solid ${T.accent}`, borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
          }} />
          <p style={{ fontFamily: 'monospace', fontSize: '13px' }}>Loading Geo-IP Intelligence…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  /* ── Error state ──────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div style={{
        padding: '1.5rem', color: T.red,
        background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem', margin: '1.5rem',
      }}>
        <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Failed to load geo data</p>
        <p style={{ fontSize: '0.875rem', margin: 0 }}>{error}</p>
        <button
          onClick={fetchData}
          style={{
            marginTop: '0.75rem', padding: '0.5rem 1rem',
            background: '#dc2626', borderRadius: '0.375rem',
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontFamily: 'monospace',
          }}
        >Retry</button>
      </div>
    );
  }

  /* ── Derived KPI values ────────────────────────────────────────────────── */
  const flags = stats?.threat_flags || {};
  const statCards = [
    { label: 'Total Tracked',  value: flags.total            ?? heatmap.reduce((s, p) => s + (p.count || 0), 0), color: T.cyan   },
    { label: 'TOR Exits',      value: flags.tor_attacks      ?? 0,                                                 color: '#a78bfa' },
    { label: 'Proxies',        value: flags.proxy_attacks    ?? 0,                                                 color: '#fbbf24' },
    { label: 'High Abuse IPs', value: flags.high_abuse       ?? 0,                                                 color: T.red    },
    { label: 'Countries',      value: flags.unique_countries ?? new Set(heatmap.map(p => p.country_code)).size,   color: '#60a5fa' },
  ];

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{
              fontSize: '1.25rem', fontWeight: 700, color: T.text,
              margin: 0, fontFamily: 'monospace', letterSpacing: '0.04em',
            }}>
              🌍 Geo-IP Threat Map
            </h1>
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
          <p style={{ color: T.muted, fontSize: '0.875rem', margin: '0.25rem 0 0', fontFamily: 'monospace' }}>
            Real-time geographic distribution of attack origins
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: '0.5rem 1rem', background: T.accent,
            border: 'none', borderRadius: '0.5rem',
            color: '#fff', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: 500, fontFamily: 'monospace',
          }}
        >↻ Refresh</button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
      }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            background: T.surface2, borderRadius: '0.75rem',
            padding: '1rem', border: `1px solid ${T.border}`,
          }}>
            <p style={{
              color: T.muted, fontSize: '0.7rem',
              textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
              fontFamily: 'monospace',
            }}>{card.label}</p>
            <p style={{
              color: card.color, fontSize: '1.75rem',
              fontWeight: 700, margin: '0.25rem 0 0',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {(card.value || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div style={{
        background: T.surface2, borderRadius: '0.75rem',
        border: `1px solid ${T.border}`,
        overflow: 'hidden', height: '480px',
      }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={10}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
        >
          {/* CartoDB Dark Matter — free, no API key, dark-theme native */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />

          {heatmap.map(point =>
            point.lat != null && point.lng != null ? (
              <CircleMarker
                key={point.country_code ?? `${point.lat}-${point.lng}`}
                center={[point.lat, point.lng]}
                radius={countToRadius(point.count)}
                pathOptions={{
                  fillColor:   countToColor(point.count),
                  color:       countToColor(point.count),
                  weight:      1,
                  opacity:     0.9,
                  fillOpacity: 0.7,
                }}
              >
                {/* Hover tooltip */}
                <Tooltip direction="top" offset={[0, -8]}>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.6, fontFamily: 'monospace' }}>
                    <strong>{point.country}</strong>
                    {point.country_code && ` (${point.country_code})`}<br />
                    Attacks: {point.count}
                    {point.critical  != null && <> &nbsp;|&nbsp; Critical: {point.critical}</>}<br />
                    {point.tor_count   != null && <>TOR: {point.tor_count} &nbsp;|&nbsp; </>}
                    {point.proxy_count != null && <>Proxy: {point.proxy_count}</>}
                  </div>
                </Tooltip>

                {/* Click popup */}
                <Popup>
                  <div style={{ fontSize: '0.875rem', minWidth: '180px', lineHeight: 1.7, fontFamily: 'monospace' }}>
                    <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 4px' }}>
                      {point.country}
                    </p>
                    {point.country_code && (
                      <p style={{ margin: 0 }}>Code: <code>{point.country_code}</code></p>
                    )}
                    <hr style={{ margin: '6px 0', borderColor: '#e5e7eb' }} />
                    <p style={{ margin: 0 }}>Total Attacks: <strong>{point.count}</strong></p>
                    {point.critical   != null && <p style={{ margin: 0, color: '#dc2626' }}>Critical: {point.critical}</p>}
                    {point.high       != null && <p style={{ margin: 0, color: '#ea580c' }}>High: {point.high}</p>}
                    {point.tor_count  != null && <p style={{ margin: 0 }}>TOR Exits: {point.tor_count}</p>}
                    {point.proxy_count!= null && <p style={{ margin: 0 }}>Proxies: {point.proxy_count}</p>}
                    {point.avg_abuse  != null && <p style={{ margin: 0 }}>Avg Abuse Score: {point.avg_abuse}%</p>}
                  </div>
                </Popup>
              </CircleMarker>
            ) : null
          )}
        </MapContainer>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem',
        fontSize: '0.875rem', color: T.muted, flexWrap: 'wrap',
        fontFamily: 'monospace',
      }}>
        <span style={{ color: T.muted2, fontWeight: 500 }}>Attack Volume:</span>
        {legend.map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: l.color, display: 'inline-block', flexShrink: 0,
            }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* ── Top Countries Table (only shown when backend sends top_countries) ───── */}
      {stats?.top_countries?.length > 0 && (
        <div style={{
          background: T.surface2, borderRadius: '0.75rem',
          border: `1px solid ${T.border}`, overflow: 'hidden',
        }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}` }}>
            <h2 style={{
              color: T.text, fontWeight: 600, margin: 0,
              fontSize: '1rem', fontFamily: 'monospace',
            }}>🏴 Top Attacking Countries</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ color: T.muted, textAlign: 'left' }}>
                  {['Rank', 'Country', 'Code', 'Attacks', 'Share'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.top_countries.map((c, i) => {
                  const total = flags.total || stats.top_countries.reduce((s, x) => s + x.count, 0);
                  const share = total ? Math.round((c.count / total) * 100) : 0;
                  return (
                    <tr key={c.country_code ?? i} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: '0.75rem 1rem', color: T.muted }}>#{i + 1}</td>
                      <td style={{ padding: '0.75rem 1rem', color: T.text, fontWeight: 500 }}>{c.country}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <code style={{
                          background: T.border, padding: '2px 6px',
                          borderRadius: '4px', fontSize: '0.75rem', color: T.text,
                        }}>{c.country_code}</code>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: T.text }}>
                        {c.count.toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            flex: 1, background: T.border,
                            borderRadius: '9999px', height: '6px',
                          }}>
                            <div style={{
                              width: `${share}%`, height: '6px',
                              borderRadius: '9999px', background: T.accent,
                            }} />
                          </div>
                          <span style={{ color: T.muted, fontSize: '0.75rem', width: '2.5rem' }}>
                            {share}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Leaflet overrides ────────────────────────────────────────────────── */}
      <style>{`
        .leaflet-control-attribution {
          background: rgba(13,17,23,0.80) !important;
          color: #4a5568 !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: #4a5568 !important; }
        .leaflet-control-zoom a {
          background: #161B22 !important;
          color: #2dd4bf !important;
          border-color: rgba(45,212,191,0.20) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(45,212,191,0.10) !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        }
      `}</style>
    </div>
  );
}
