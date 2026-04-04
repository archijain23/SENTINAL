/**
 * GeoPage — Live World Threat Map
 *
 * Map:    Leaflet.js + CartoDB Dark Matter tiles (no API key needed)
 * Dots:   CircleMarker per unique IP, coloured by severity
 * Data:   GET /api/geo/threats  (initial load)
 * RT:     socket.on('attack:new') — adds/updates markers live
 * Table:  scrollable feed below the map, click row → fly-to marker
 * Detail: panel slides up on row/marker click
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ipAPI } from '../services/api';
import { connectSocket, SOCKET_EVENTS } from '../services/socket';

/* ── Design tokens — matches SENTINAL dark-terminal palette ──────────── */
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
  textDim: '#4A5568',
};

const SEV = {
  CRITICAL: { color: '#FF3D71', bg: 'rgba(255,61,113,0.12)',  border: 'rgba(255,61,113,0.30)',  radius: 9,  weight: 2 },
  HIGH:     { color: '#FF9500', bg: 'rgba(255,149,0,0.12)',   border: 'rgba(255,149,0,0.30)',   radius: 7,  weight: 1.5 },
  MEDIUM:   { color: '#FFD700', bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.30)',   radius: 5,  weight: 1 },
  LOW:      { color: '#00FF88', bg: 'rgba(0,255,136,0.10)',   border: 'rgba(0,255,136,0.25)',   radius: 4,  weight: 1 },
};

function sevStyle(sev) { return SEV[sev] ?? SEV.LOW; }

/* ── Normalise raw API / socket shapes ────────────────────────────── */
function normalise(raw) {
  const geo = raw.geoIntel ?? raw.geo ?? {};
  const lat = geo.latitude  ?? raw.latitude  ?? null;
  const lng = geo.longitude ?? raw.longitude ?? null;
  return {
    id:       raw._id ?? raw.id ?? Math.random().toString(36).slice(2),
    ip:       raw.srcIP ?? raw.src_ip ?? raw.ip ?? '0.0.0.0',
    country:  geo.country  ?? raw.country  ?? 'Unknown',
    city:     geo.city     ?? raw.city     ?? '—',
    lat,
    lng,
    type:     raw.attackType ?? raw.type ?? 'Unknown',
    severity: (raw.severity ?? 'LOW').toUpperCase(),
    count:    raw.count ?? raw.eventCount ?? 1,
    isTor:    geo.is_tor   ?? raw.is_tor   ?? false,
    isProxy:  geo.is_proxy ?? raw.is_proxy ?? false,
    abuseScore: geo.abuse_confidence_score ?? raw.abuseScore ?? null,
    ts:       raw.timestamp ?? raw.createdAt ?? new Date().toISOString(),
  };
}

/* ── Tiny shared components ──────────────────────────────────────── */
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
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '8px',
      padding: '14px 18px',
      minWidth: 0,
    }}>
      <div style={{
        fontFamily: 'monospace', fontWeight: 700,
        fontSize: '22px', color, lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        filter: loading ? 'blur(6px)' : 'none',
        transition: 'filter 0.3s',
      }}>
        {loading ? '000' : value}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '10px', color: T.muted, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
        {label}
      </div>
    </div>
  );
}

/* ── Leaflet loader (dynamic import, no bundler issues) ─────────────── */
let L = null;
async function getLeaflet() {
  if (L) return L;
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id   = 'leaflet-css';
    link.rel  = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  const mod = await import('https://esm.sh/leaflet@1.9.4');
  L = mod.default ?? mod;
  return L;
}

/* ── MAP COMPONENT ──────────────────────────────────────────────── */
function WorldMap({ attacks, onSelect, selected }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);   // Leaflet map instance
  const markersRef   = useRef({});     // ip → CircleMarker

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    let cancelled = false;

    getLeaflet().then(Leaflet => {
      if (cancelled || !containerRef.current) return;

      const map = Leaflet.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: false,
        minZoom: 1,
        maxZoom: 10,
        preferCanvas: true,
      });

      // Dark tile: CartoDB Dark Matter (free, no API key)
      Leaflet.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19 }
      ).addTo(map);

      // Subtle cyan grid attribution strip
      Leaflet.control.attribution({ prefix: false }).addTo(map);

      mapRef.current = map;

      // Render any attacks already loaded
      renderMarkers(Leaflet, map, attacks, onSelect);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers when attacks list changes
  useEffect(() => {
    if (!mapRef.current) return;
    getLeaflet().then(Leaflet => {
      renderMarkers(Leaflet, mapRef.current, attacks, onSelect);
    });
  }, [attacks, onSelect]);

  // Fly to selected marker
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    const marker = markersRef.current[selected.ip];
    if (marker) {
      mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 4), { duration: 0.8 });
      marker.openTooltip();
    }
  }, [selected]);

  function renderMarkers(Leaflet, map, list, onSelectCb) {
    const seen = new Set();
    list.forEach(a => {
      if (a.lat == null || a.lng == null) return;
      seen.add(a.ip);
      const s = sevStyle(a.severity);

      if (markersRef.current[a.ip]) {
        // Update existing
        markersRef.current[a.ip].setStyle({
          color: s.color, fillColor: s.color,
          radius: Math.min(s.radius + Math.log2(a.count + 1), 18),
        });
        return;
      }

      const marker = Leaflet.circleMarker([a.lat, a.lng], {
        radius:      Math.min(s.radius + Math.log2(a.count + 1), 18),
        color:       s.color,
        fillColor:   s.color,
        fillOpacity: 0.55,
        weight:      s.weight,
        opacity:     0.9,
      }).addTo(map);

      marker.bindTooltip(
        `<div style="font-family:monospace;font-size:11px;line-height:1.5;color:#B8C4E0;background:#161B22;border:1px solid rgba(0,245,255,0.18);padding:7px 10px;border-radius:6px">
          <b style="color:${s.color}">${a.ip}</b><br/>
          ${a.city !== '—' ? a.city + ', ' : ''}${a.country}<br/>
          <span style="color:#6B7894">${a.type} · ${a.severity}</span>
        </div>`,
        { sticky: true, opacity: 1, className: 'sentinal-tooltip' }
      );

      marker.on('click', () => onSelectCb(a));
      markersRef.current[a.ip] = marker;
    });
  }

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '16px',
      position: 'relative',
    }}>
      {/* Map header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: `1px solid ${T.borderD}`,
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: T.cyan, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Live Threat Map
        </span>
        <div style={{ display: 'flex', gap: '14px' }}>
          {Object.entries(SEV).map(([k, v]) => (
            <span key={k} style={{ fontFamily: 'monospace', fontSize: '10px', color: v.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: v.color, display: 'inline-block' }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Leaflet container */}
      <div
        ref={containerRef}
        style={{ height: '420px', width: '100%', background: '#0D1117' }}
      />

      {attacks.filter(a => a.lat != null).length === 0 && (
        <div style={{
          position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'monospace', fontSize: '11px', color: T.muted,
          background: 'rgba(13,17,23,0.80)', padding: '6px 14px', borderRadius: '6px',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          No geo-located events yet — fire an attack on /simulate to populate the map
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function GeoPage() {
  const [attacks,  setAttacks]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  /* ─ Initial data load ────────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await ipAPI.getGeoThreats().catch(() => []);
      const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.threats ?? []);
      setAttacks(list.map(normalise));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─ Real-time updates ──────────────────────────────────────────── */
  useEffect(() => {
    const socket = connectSocket();
    const handler = (event) => {
      const item = normalise(event);
      setAttacks(prev => {
        const idx = prev.findIndex(a => a.ip === item.ip);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], count: updated[idx].count + 1,
            severity: item.severity, type: item.type };
          return updated;
        }
        return [item, ...prev].slice(0, 200);
      });
    };
    socket.on(SOCKET_EVENTS.ATTACK_NEW ?? 'attack:new', handler);
    socket.on('geo:event', handler);
    return () => {
      socket.off(SOCKET_EVENTS.ATTACK_NEW ?? 'attack:new', handler);
      socket.off('geo:event', handler);
      // Do NOT call disconnectSocket() — shared singleton
    };
  }, []);

  const handleSelect = useCallback((a) => {
    setSelected(prev => prev?.id === a.id ? null : a);
  }, []);

  /* ─ Derived stats ──────────────────────────────────────────────── */
  const stats = {
    total:     attacks.reduce((s, a) => s + a.count, 0),
    countries: new Set(attacks.map(a => a.country).filter(c => c !== 'Unknown')).size,
    critical:  attacks.filter(a => a.severity === 'CRITICAL').length,
    high:      attacks.filter(a => a.severity === 'HIGH').length,
    tor:       attacks.filter(a => a.isTor).length,
  };

  return (
    <div style={{ maxWidth: '1200px', fontFamily: 'monospace' }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{
          fontFamily: 'monospace', fontWeight: 700,
          fontSize: '13px', letterSpacing: '0.18em',
          textTransform: 'uppercase', color: T.cyan,
          margin: '0 0 4px',
        }}>
          Geo Threat Map
        </h1>
        <p style={{ margin: 0, fontSize: '11px', color: T.muted }}>
          Live attack origins · IP geolocation · real-time dot overlay
        </p>
      </div>

      {/* ── KPI row ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <KpiCard label="Total Events"  value={stats.total}     color={T.cyan}   loading={loading} />
        <KpiCard label="Countries"     value={stats.countries} color='#a78bfa'  loading={loading} />
        <KpiCard label="Critical"      value={stats.critical}  color={T.red}    loading={loading} />
        <KpiCard label="High"          value={stats.high}      color={T.orange} loading={loading} />
        <KpiCard label="TOR / Proxy"   value={stats.tor}       color={T.muted}  loading={loading} />
      </div>

      {/* ── World map ───────────────────────────────────────── */}
      <WorldMap attacks={attacks} onSelect={handleSelect} selected={selected} />

      {/* ── Attack origins feed ─────────────────────────────── */}
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '14px',
      }}>
        {/* table header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${T.borderD}`,
        }}>
          <span style={{ fontSize: '11px', color: T.cyan, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Attack Origins Feed
          </span>
          <span style={{ fontSize: '10px', color: T.muted }}>
            {loading ? 'Loading…' : `${attacks.length} unique sources`}
          </span>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '320px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: T.surface, zIndex: 1 }}>
              <tr>
                {['IP Address', 'Location', 'Attack Type', 'Severity', 'Events', 'Flags'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left',
                    color: T.muted, fontWeight: 500, whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${T.borderD}`,
                    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[140, 120, 100, 70, 40, 60].map((w, j) => (
                      <td key={j} style={{ padding: '10px 14px' }}>
                        <div style={{
                          height: '11px', borderRadius: '3px',
                          width: `${w}px`,
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
                    No geo events yet — fire a simulation to populate the feed
                  </td>
                </tr>
              ) : attacks.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => handleSelect(a)}
                  style={{
                    borderTop: `1px solid ${T.borderD}`,
                    cursor: 'pointer',
                    background: selected?.id === a.id
                      ? 'rgba(0,245,255,0.04)'
                      : 'transparent',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => { if (selected?.id !== a.id) e.currentTarget.style.background = 'rgba(0,245,255,0.02)'; }}
                  onMouseLeave={e => { if (selected?.id !== a.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '9px 14px', color: T.cyan, fontFamily: 'monospace' }}>{a.ip}</td>
                  <td style={{ padding: '9px 14px', color: T.text }}>
                    {a.city !== '—' ? `${a.city}, ` : ''}{a.country}
                  </td>
                  <td style={{ padding: '9px 14px', color: T.muted }}>{a.type}</td>
                  <td style={{ padding: '9px 14px' }}><SevBadge sev={a.severity} /></td>
                  <td style={{ padding: '9px 14px', color: T.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{a.count}</td>
                  <td style={{ padding: '9px 14px', fontSize: '10px', color: T.muted }}>
                    {a.isTor   && <span style={{ color: T.red,    marginRight: '4px' }}>TOR</span>}
                    {a.isProxy && <span style={{ color: T.orange, marginRight: '4px' }}>PROXY</span>}
                    {a.lat != null && <span style={{ color: T.green }}>MAP</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail panel ───────────────────────────────────────── */}
      {selected && (
        <div style={{
          background: T.surface,
          border: `1px solid ${sevStyle(selected.severity).border}`,
          borderRadius: '10px',
          padding: '16px 20px',
          animation: 'slideUp 160ms ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: T.cyan, letterSpacing: '0.04em' }}>{selected.ip}</div>
              <div style={{ fontSize: '11px', color: T.muted, marginTop: '3px' }}>
                {selected.city !== '—' ? `${selected.city}, ` : ''}{selected.country}
                {selected.lat != null && ` · ${selected.lat.toFixed(2)}, ${selected.lng.toFixed(2)}`}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}
              aria-label="Close"
            >×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Severity',      value: <SevBadge sev={selected.severity} /> },
              { label: 'Attack Type',   value: selected.type },
              { label: 'Event Count',   value: selected.count },
              { label: 'TOR Exit',      value: selected.isTor   ? '✓ Yes' : '—' },
              { label: 'Open Proxy',    value: selected.isProxy ? '✓ Yes' : '—' },
              { label: 'Abuse Score',   value: selected.abuseScore != null ? `${selected.abuseScore}%` : '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: '10px', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{f.label}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: T.text }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }
        /* Override Leaflet default popup/tooltip background */
        .sentinal-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .leaflet-tooltip   { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-container { background: #0D1117 !important; }
        .leaflet-control-zoom a {
          background: #161B22 !important;
          color: #00F5FF !important;
          border-color: rgba(0,245,255,0.15) !important;
        }
        .leaflet-control-zoom a:hover { background: #1c2330 !important; }
        .leaflet-control-attribution {
          background: rgba(13,17,23,0.7) !important;
          color: #4A5568 !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: #4A5568 !important; }
      `}</style>
    </div>
  );
}
