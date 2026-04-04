/**
 * GeoPage — Live World Threat Map
 *
 * Data flow:
 *   1. GET /api/geo/threats   — all unique IPs with counts + geo (primary)
 *   2. Fallback: GET /api/geo/heatmap — if threats returns empty
 *   3. socket 'attack:new'    — real-time additions/updates
 *
 * Map: Leaflet + CartoDB Dark Matter tiles (no API key)
 * Dots: CircleMarker per IP, coloured by severity, radius scales with count
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ipAPI } from '../services/api';
import { connectSocket, SOCKET_EVENTS } from '../services/socket';

/* ── Design tokens ────────────────────────────────────────────────────── */
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
  CRITICAL: { color: '#FF3D71', bg: 'rgba(255,61,113,0.12)',  border: 'rgba(255,61,113,0.30)',  radius: 9,  weight: 2 },
  HIGH:     { color: '#FF9500', bg: 'rgba(255,149,0,0.12)',   border: 'rgba(255,149,0,0.30)',   radius: 7,  weight: 1.5 },
  MEDIUM:   { color: '#FFD700', bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.30)',   radius: 5,  weight: 1 },
  LOW:      { color: '#00FF88', bg: 'rgba(0,255,136,0.10)',   border: 'rgba(0,255,136,0.25)',   radius: 4,  weight: 1 },
};
const sevStyle = (sev) => SEV[(sev || '').toUpperCase()] ?? SEV.LOW;

/* ── Normalise — handles both /threats shape and socket push shape ───────── */
function normalise(raw) {
  // /threats returns flat fields; socket push may nest under geoIntel
  const geo = raw.geoIntel ?? {};
  return {
    id:       raw._id ?? raw.id ?? raw.ip ?? Math.random().toString(36).slice(2),
    ip:       raw.ip ?? raw.srcIP ?? raw.src_ip ?? '0.0.0.0',
    country:  raw.country  ?? geo.country  ?? 'Unknown',
    city:     raw.city     ?? geo.city     ?? null,
    lat:      raw.latitude  ?? geo.latitude  ?? null,
    lng:      raw.longitude ?? geo.longitude ?? null,
    type:     raw.attackType ?? raw.type ?? 'Unknown',
    severity: (raw.severity ?? 'low').toUpperCase(),
    count:    raw.count ?? raw.eventCount ?? 1,
    isTor:    raw.is_tor   ?? geo.is_tor   ?? false,
    isProxy:  raw.is_proxy ?? geo.is_proxy ?? false,
    abuseScore: raw.abuse_confidence_score ?? geo.abuse_confidence_score ?? null,
    ts:       raw.lastSeen ?? raw.timestamp ?? raw.createdAt ?? new Date().toISOString(),
  };
}

/* ── Shared tiny components ────────────────────────────────────────── */
function SevBadge({ sev }) {
  const s = sevStyle(sev);
  return (
    <span style={{
      fontFamily:'monospace', fontSize:'10px', fontWeight:700,
      letterSpacing:'0.08em', textTransform:'uppercase',
      padding:'2px 7px', borderRadius:'4px',
      color:s.color, background:s.bg, border:`1px solid ${s.border}`,
    }}>{sev}</span>
  );
}

function KpiCard({ label, value, color, loading }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:'8px', padding:'14px 18px', minWidth:0 }}>
      <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:'22px', color, lineHeight:1,
        fontVariantNumeric:'tabular-nums', filter:loading?'blur(5px)':'none', transition:'filter 0.3s' }}>
        {loading ? '000' : value}
      </div>
      <div style={{ fontFamily:'monospace', fontSize:'10px', color:T.muted, marginTop:'5px',
        textTransform:'uppercase', letterSpacing:'0.10em' }}>
        {label}
      </div>
    </div>
  );
}

/* ── Leaflet dynamic loader ──────────────────────────────────────────── */
let _L = null;
async function getLeaflet() {
  if (_L) return _L;
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css'; link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  const mod = await import('https://esm.sh/leaflet@1.9.4');
  _L = mod.default ?? mod;
  return _L;
}

/* ── WorldMap component ─────────────────────────────────────────────── */
function WorldMap({ attacks, onSelect, selected }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});
  const onSelectRef  = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    let dead = false;
    getLeaflet().then(L => {
      if (dead || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        center: [20, 0], zoom: 2,
        zoomControl: true, attributionControl: false,
        minZoom: 1, maxZoom: 10, preferCanvas: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
      L.control.attribution({ prefix: false }).addTo(map);
      mapRef.current = map;
    });
    return () => { dead = true; };
  }, []);

  // Add / update markers when attacks list changes
  useEffect(() => {
    if (!mapRef.current) return;
    getLeaflet().then(L => {
      attacks.forEach(a => {
        if (a.lat == null || a.lng == null) return;
        const s = sevStyle(a.severity);
        const r = Math.min(s.radius + Math.log2(a.count + 1), 18);
        if (markersRef.current[a.ip]) {
          markersRef.current[a.ip].setStyle({ color: s.color, fillColor: s.color, radius: r });
          return;
        }
        const marker = L.circleMarker([a.lat, a.lng], {
          radius: r, color: s.color, fillColor: s.color,
          fillOpacity: 0.55, weight: s.weight, opacity: 0.9,
        }).addTo(mapRef.current);
        marker.bindTooltip(
          `<div style="font-family:monospace;font-size:11px;line-height:1.6;color:#B8C4E0;
            background:#161B22;border:1px solid rgba(0,245,255,0.18);
            padding:7px 11px;border-radius:6px;white-space:nowrap">
            <b style="color:${s.color}">${a.ip}</b><br/>
            ${a.city ? a.city + ', ' : ''}${a.country}<br/>
            <span style="color:#6B7894">${a.type} · ${a.severity}</span>
          </div>`,
          { sticky: true, opacity: 1, className: 'sentinal-tt' }
        );
        marker.on('click', () => onSelectRef.current(a));
        markersRef.current[a.ip] = marker;
      });
    });
  }, [attacks]);

  // Fly to selected
  useEffect(() => {
    if (!selected || !mapRef.current) return;
    const m = markersRef.current[selected.ip];
    if (m) mapRef.current.flyTo(m.getLatLng(), Math.max(mapRef.current.getZoom(), 4), { duration: 0.7 });
  }, [selected]);

  const mapped = attacks.filter(a => a.lat != null).length;

  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:'10px',
      overflow:'hidden', marginBottom:'16px', position:'relative' }}>
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 16px', borderBottom:`1px solid ${T.borderD}` }}>
        <span style={{ fontFamily:'monospace', fontSize:'11px', color:T.cyan,
          textTransform:'uppercase', letterSpacing:'0.12em' }}>Live Threat Map</span>
        <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
          {Object.entries(SEV).map(([k, v]) => (
            <span key={k} style={{ fontFamily:'monospace', fontSize:'10px', color:v.color,
              display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%',
                background:v.color, display:'inline-block' }} />{k}
            </span>
          ))}
          <span style={{ fontFamily:'monospace', fontSize:'10px', color:T.muted }}>
            {mapped} dot{mapped !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {/* map */}
      <div ref={containerRef} style={{ height:'420px', width:'100%', background:'#0D1117' }} />
      {/* empty hint */}
      {mapped === 0 && (
        <div style={{ position:'absolute', bottom:'16px', left:'50%', transform:'translateX(-50%)',
          fontFamily:'monospace', fontSize:'11px', color:T.muted,
          background:'rgba(13,17,23,0.85)', padding:'6px 14px', borderRadius:'6px',
          pointerEvents:'none', whiteSpace:'nowrap' }}>
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
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(null);

  /* ─ Load ───────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Primary: /threats aggregates per-IP, includes ALL events (geo or not)
      let raw = await ipAPI.getGeoThreats();
      let list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.threats ?? []);

      // Fallback: if threats endpoint returned nothing, try heatmap
      // (heatmap only has geo-enriched events but better than empty)
      if (list.length === 0) {
        const hm = await ipAPI.getGeoHeatmap().catch(() => null);
        const hmData = hm?.heatmap ?? hm?.data ?? hm ?? [];
        list = Array.isArray(hmData) ? hmData.map(h => ({
          ip: h.country_code ?? h._id ?? 'Unknown',
          country: h.country, latitude: h.lat, longitude: h.lng,
          attackType: 'unknown', severity: 'low',
          count: h.count, is_tor: false, is_proxy: false,
        })) : [];
      }

      setAttacks(list.map(normalise));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─ Real-time ───────────────────────────────────────────────── */
  useEffect(() => {
    const socket = connectSocket();
    const handler = (event) => {
      const item = normalise(event);
      setAttacks(prev => {
        const idx = prev.findIndex(a => a.ip === item.ip);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], count: next[idx].count + 1,
            severity: item.severity, type: item.type };
          return next;
        }
        return [item, ...prev].slice(0, 200);
      });
    };
    const ev1 = SOCKET_EVENTS?.ATTACK_NEW ?? 'attack:new';
    socket.on(ev1, handler);
    socket.on('geo:event', handler);
    return () => {
      socket.off(ev1, handler);
      socket.off('geo:event', handler);
      // intentionally NOT calling disconnectSocket() — shared singleton
    };
  }, []);

  const handleSelect = useCallback(a => setSelected(p => p?.id === a.id ? null : a), []);

  /* ─ Stats ──────────────────────────────────────────────────── */
  const stats = {
    total:     attacks.reduce((s, a) => s + a.count, 0),
    countries: new Set(attacks.map(a => a.country).filter(c => c !== 'Unknown')).size,
    critical:  attacks.filter(a => a.severity === 'CRITICAL').length,
    high:      attacks.filter(a => a.severity === 'HIGH').length,
    tor:       attacks.filter(a => a.isTor).length,
  };

  return (
    <div style={{ maxWidth:'1200px', fontFamily:'monospace' }}>

      {/* header */}
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontFamily:'monospace', fontWeight:700, fontSize:'13px',
          letterSpacing:'0.18em', textTransform:'uppercase', color:T.cyan, margin:'0 0 4px' }}>
          Geo Threat Map
        </h1>
        <p style={{ margin:0, fontSize:'11px', color:T.muted }}>
          Live attack origins · IP geolocation · real-time dot overlay
        </p>
      </div>

      {/* error banner */}
      {error && (
        <div style={{ padding:'10px 14px', borderRadius:'7px', marginBottom:'14px',
          background:'rgba(255,61,113,0.08)', border:'1px solid rgba(255,61,113,0.25)',
          fontFamily:'monospace', fontSize:'11px', color:T.red }}>
          ⚠ {error}
        </div>
      )}

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'16px' }}>
        <KpiCard label="Total Events"  value={stats.total}     color={T.cyan}   loading={loading} />
        <KpiCard label="Countries"     value={stats.countries} color='#a78bfa'  loading={loading} />
        <KpiCard label="Critical"      value={stats.critical}  color={T.red}    loading={loading} />
        <KpiCard label="High"          value={stats.high}      color={T.orange} loading={loading} />
        <KpiCard label="TOR / Proxy"   value={stats.tor}       color={T.muted}  loading={loading} />
      </div>

      {/* map */}
      <WorldMap attacks={attacks} onSelect={handleSelect} selected={selected} />

      {/* feed table */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`,
        borderRadius:'10px', overflow:'hidden', marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 16px', borderBottom:`1px solid ${T.borderD}` }}>
          <span style={{ fontSize:'11px', color:T.cyan, textTransform:'uppercase', letterSpacing:'0.12em' }}>
            Attack Origins Feed
          </span>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <span style={{ fontSize:'10px', color:T.muted }}>
              {loading ? 'Loading…' : `${attacks.length} unique sources`}
            </span>
            <button onClick={load} disabled={loading}
              style={{ fontFamily:'monospace', fontSize:'10px', color:T.cyan,
                background:'rgba(0,245,255,0.06)', border:`1px solid ${T.border}`,
                borderRadius:'5px', padding:'3px 10px', cursor:'pointer',
                opacity: loading ? 0.4 : 1 }}>
              {loading ? '…' : '↺ Refresh'}
            </button>
          </div>
        </div>

        <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'340px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead style={{ position:'sticky', top:0, background:T.surface, zIndex:1 }}>
              <tr>
                {['IP Address','Location','Attack Type','Severity','Events','Flags'].map(h => (
                  <th key={h} style={{ padding:'8px 14px', textAlign:'left', color:T.muted,
                    fontWeight:500, whiteSpace:'nowrap', borderBottom:`1px solid ${T.borderD}`,
                    fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[140,120,100,70,40,60].map((w, j) => (
                      <td key={j} style={{ padding:'10px 14px' }}>
                        <div style={{ height:'11px', borderRadius:'3px', width:`${w}px`,
                          background:'rgba(0,245,255,0.05)', animation:'shimmer 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : attacks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding:'36px', textAlign:'center', color:T.muted }}>
                    No attacks recorded yet — fire a simulation on /simulate to generate events
                  </td>
                </tr>
              ) : attacks.map(a => (
                <tr key={a.id}
                  onClick={() => handleSelect(a)}
                  style={{ borderTop:`1px solid ${T.borderD}`, cursor:'pointer',
                    background: selected?.id === a.id ? 'rgba(0,245,255,0.04)' : 'transparent',
                    transition:'background 120ms' }}
                  onMouseEnter={e => { if (selected?.id !== a.id) e.currentTarget.style.background='rgba(0,245,255,0.02)'; }}
                  onMouseLeave={e => { if (selected?.id !== a.id) e.currentTarget.style.background='transparent'; }}
                >
                  <td style={{ padding:'9px 14px', color:T.cyan }}>{a.ip}</td>
                  <td style={{ padding:'9px 14px', color:T.text }}>
                    {a.city ? `${a.city}, ` : ''}{a.country}
                  </td>
                  <td style={{ padding:'9px 14px', color:T.muted }}>{a.type}</td>
                  <td style={{ padding:'9px 14px' }}><SevBadge sev={a.severity} /></td>
                  <td style={{ padding:'9px 14px', color:T.text, fontVariantNumeric:'tabular-nums', fontWeight:700 }}>{a.count}</td>
                  <td style={{ padding:'9px 14px', fontSize:'10px' }}>
                    {a.isTor   && <span style={{ color:T.red,   marginRight:'4px' }}>TOR</span>}
                    {a.isProxy && <span style={{ color:T.orange,marginRight:'4px' }}>PROXY</span>}
                    {a.lat != null && <span style={{ color:T.green }}>MAP</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* detail panel */}
      {selected && (
        <div style={{ background:T.surface,
          border:`1px solid ${sevStyle(selected.severity).border}`,
          borderRadius:'10px', padding:'16px 20px', animation:'slideUp 160ms ease' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'14px' }}>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:T.cyan, letterSpacing:'0.04em' }}>{selected.ip}</div>
              <div style={{ fontSize:'11px', color:T.muted, marginTop:'3px' }}>
                {selected.city ? `${selected.city}, ` : ''}{selected.country}
                {selected.lat != null && ` · ${selected.lat.toFixed(2)}°, ${selected.lng.toFixed(2)}°`}
              </div>
            </div>
            <button onClick={() => setSelected(null)}
              style={{ background:'none', border:'none', cursor:'pointer',
                color:T.muted, fontSize:'18px', lineHeight:1, padding:'2px 6px' }}
              aria-label="Close">×</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'12px' }}>
            {[
              { label:'Severity',    value:<SevBadge sev={selected.severity} /> },
              { label:'Attack Type', value:selected.type },
              { label:'Event Count', value:selected.count },
              { label:'TOR Exit',    value:selected.isTor   ? '✓ Yes' : '—' },
              { label:'Open Proxy',  value:selected.isProxy ? '✓ Yes' : '—' },
              { label:'Abuse Score', value:selected.abuseScore != null ? `${selected.abuseScore}%` : '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize:'10px', color:T.muted, textTransform:'uppercase',
                  letterSpacing:'0.08em', marginBottom:'4px' }}>{f.label}</div>
                <div style={{ fontSize:'12px', fontWeight:600, color:T.text }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .sentinal-tt { background:transparent!important; border:none!important; box-shadow:none!important; padding:0!important; }
        .leaflet-tooltip { background:transparent!important; border:none!important; box-shadow:none!important; padding:0!important; }
        .leaflet-container { background:#0D1117!important; }
        .leaflet-control-zoom a { background:#161B22!important; color:#00F5FF!important; border-color:rgba(0,245,255,0.15)!important; }
        .leaflet-control-zoom a:hover { background:#1c2330!important; }
        .leaflet-control-attribution { background:rgba(13,17,23,0.7)!important; color:#4A5568!important; font-size:9px!important; }
        .leaflet-control-attribution a { color:#4A5568!important; }
      `}</style>
    </div>
  );
}
