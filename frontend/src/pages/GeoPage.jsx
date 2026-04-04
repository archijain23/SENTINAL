/**
 * GeoPage — Live World Threat Map
 *
 * Map: Three.js globe via @react-three/fiber + @react-three/drei (already installed)
 * No new npm installs required.
 *
 * Data flow:
 *   1. GET /api/geo/threats  — all unique IPs with counts + geo (MongoDB-direct)
 *   2. socket 'attack:new'   — real-time updates pushed by gateway
 *
 * Socket fix: uses getSocket() (singleton re-use) instead of connectSocket()
 * to avoid triggering a disconnect/reconnect on every page mount.
 */
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere }      from '@react-three/drei';
import * as THREE from 'three';
import { ipAPI }                        from '../services/api';
import { getSocket, SOCKET_EVENTS }     from '../services/socket';

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
  CRITICAL: { color: '#FF3D71', hex: 0xFF3D71, bg: 'rgba(255,61,113,0.12)',  border: 'rgba(255,61,113,0.30)' },
  HIGH:     { color: '#FF9500', hex: 0xFF9500, bg: 'rgba(255,149,0,0.12)',   border: 'rgba(255,149,0,0.30)'  },
  MEDIUM:   { color: '#FFD700', hex: 0xFFD700, bg: 'rgba(255,215,0,0.12)',   border: 'rgba(255,215,0,0.30)'  },
  LOW:      { color: '#00FF88', hex: 0x00FF88, bg: 'rgba(0,255,136,0.10)',   border: 'rgba(0,255,136,0.25)'  },
};
const sevStyle = s => SEV[(s || '').toUpperCase()] ?? SEV.LOW;

/* ── Normalise ── handles both /threats shape and socket push ─────────────── */
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

/* ── lat/lng → 3D cartesian on unit sphere ─────────────────────────────────── */
function latLngToVec3(lat, lng, r = 1.01) {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ── Single attack dot on the globe ────────────────────────────────────────── */
function AttackDot({ attack, onHover, onClick }) {
  const meshRef  = useRef();
  const s        = sevStyle(attack.severity);
  const pos      = latLngToVec3(attack.lat, attack.lng);
  const baseR    = 0.008 + Math.min(Math.log2(attack.count + 1) * 0.003, 0.022);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const pulse = 1 + 0.25 * Math.sin(clock.elapsedTime * 3 + attack.lat);
    meshRef.current.scale.setScalar(hovered ? 1.8 : pulse);
  });

  return (
    <mesh
      ref={meshRef}
      position={pos}
      onPointerOver={e => { e.stopPropagation(); setHovered(true);  onHover(attack); }}
      onPointerOut={e  => { e.stopPropagation(); setHovered(false); onHover(null);   }}
      onClick={e        => { e.stopPropagation(); onClick(attack); }}
    >
      <sphereGeometry args={[baseR, 8, 8]} />
      <meshBasicMaterial color={s.hex} transparent opacity={hovered ? 1 : 0.85} />
    </mesh>
  );
}

/* ── Glow ring around hovered dot ─────────────────────────────────────────── */
function GlowRing({ attack }) {
  const ringRef = useRef();
  const s       = sevStyle(attack.severity);
  const pos     = latLngToVec3(attack.lat, attack.lng, 1.012);
  const normal  = pos.clone().normalize();
  const quat    = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), normal
  );

  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.z = clock.elapsedTime * 1.5;
  });

  return (
    <mesh ref={ringRef} position={pos} quaternion={quat}>
      <ringGeometry args={[0.022, 0.030, 32]} />
      <meshBasicMaterial color={s.hex} transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ── Animated ping line radiating outward from dot ─────────────────────────── */
function PingLine({ attack }) {
  const lineRef = useRef();
  const s       = sevStyle(attack.severity);
  const start   = latLngToVec3(attack.lat, attack.lng, 1.01);
  const end     = latLngToVec3(attack.lat, attack.lng, 1.06);
  const geo     = new THREE.BufferGeometry().setFromPoints([start, end]);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      lineRef.current.material.opacity =
        0.3 + 0.4 * Math.abs(Math.sin(clock.elapsedTime * 4 + attack.lng));
    }
  });

  return (
    <line ref={lineRef} geometry={geo}>
      <lineBasicMaterial color={s.hex} transparent opacity={0.6} />
    </line>
  );
}

/* ── Globe scene ───────────────────────────────────────────────────────────── */
function GlobeScene({ attacks, onHover, onSelect, hovered }) {
  const { camera } = useThree();

  useEffect(() => { camera.position.set(0, 0, 2.6); }, [camera]);

  const dots = attacks.filter(a => a.lat != null && a.lng != null);

  // Latitude / longitude grid lines
  const gridLines = [];
  for (let lat = -80; lat <= 80; lat += 20) {
    const pts = [];
    for (let lng = 0; lng <= 360; lng += 3) pts.push(latLngToVec3(lat, lng - 180, 1.001));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    gridLines.push(<line key={`lat${lat}`} geometry={g}><lineBasicMaterial color={0x1e3a5a} transparent opacity={0.7} /></line>);
  }
  for (let lng = 0; lng < 360; lng += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 3) pts.push(latLngToVec3(lat, lng - 180, 1.001));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    gridLines.push(<line key={`lng${lng}`} geometry={g}><lineBasicMaterial color={0x1e3a5a} transparent opacity={0.7} /></line>);
  }

  return (
    <>
      {/* Stronger ambient so the dark sphere surface is never pure black */}
      <ambientLight intensity={0.8} />
      {/* Main cyan key light — boosted for specular highlight on the sphere */}
      <pointLight position={[4, 4, 4]}    intensity={2.0} color={0x00f5ff} />
      {/* Red-pink fill from behind */}
      <pointLight position={[-4, -2, -4]} intensity={0.6} color={0xff3d71} />
      {/* Soft warm back-fill so the night side stays slightly visible */}
      <pointLight position={[0, -4, -2]}  intensity={0.3} color={0x223355} />

      {/* Globe core — meshPhongMaterial responds well to low-intensity lights;
          emissive ensures the unlit side is never indistinguishable from the bg */}
      <Sphere args={[1, 64, 64]}>
        <meshPhongMaterial
          color={0x0a1628}
          emissive={0x071020}
          emissiveIntensity={1}
          shininess={18}
          transparent
          opacity={0.97}
        />
      </Sphere>

      {/* Atmosphere glow — stronger edge halo so the sphere silhouette reads clearly */}
      <Sphere args={[1.04, 32, 32]}>
        <meshBasicMaterial color={0x004466} transparent opacity={0.18} side={THREE.BackSide} />
      </Sphere>

      {gridLines}

      {dots.map(a => (
        <group key={a.ip}>
          <AttackDot attack={a} onHover={onHover} onClick={onSelect} />
          <PingLine  attack={a} />
          {hovered?.ip === a.ip && <GlowRing attack={a} />}
        </group>
      ))}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.4}
        maxDistance={4}
        autoRotate={true}
        autoRotateSpeed={0.4}
        dampingFactor={0.08}
        enableDamping={true}
      />
    </>
  );
}

/* ── Shared UI components ─────────────────────────────────────────────────── */
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
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:'8px',
      padding:'14px 18px', minWidth:0 }}>
      <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:'22px', color,
        lineHeight:1, fontVariantNumeric:'tabular-nums',
        filter:loading?'blur(5px)':'none', transition:'filter 0.3s' }}>
        {loading ? '000' : value}
      </div>
      <div style={{ fontFamily:'monospace', fontSize:'10px', color:T.muted, marginTop:'5px',
        textTransform:'uppercase', letterSpacing:'0.10em' }}>{label}</div>
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
  const [hovered,  setHovered]  = useState(null);
  const [live,     setLive]     = useState(false);

  /* ─ Load ─────────────────────────────────────────────────────────────── */
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

  /* ─ Real-time socket ─────────────────────────────────────────────────── */
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

  /* ─ Derived stats ────────────────────────────────────────────────────── */
  const stats = {
    total:     attacks.reduce((s, a) => s + a.count, 0),
    countries: new Set(attacks.map(a => a.country).filter(c => c !== 'Unknown')).size,
    critical:  attacks.filter(a => a.severity === 'CRITICAL').length,
    high:      attacks.filter(a => a.severity === 'HIGH').length,
    tor:       attacks.filter(a => a.isTor || a.isProxy).length,
  };
  const mapped = attacks.filter(a => a.lat != null).length;

  return (
    <div style={{ maxWidth:'1200px', fontFamily:'monospace' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
          <h1 style={{ fontFamily:'monospace', fontWeight:700, fontSize:'13px',
            letterSpacing:'0.18em', textTransform:'uppercase', color:T.cyan, margin:0 }}>
            Geo Threat Map
          </h1>
          {live && (
            <span style={{
              fontFamily:'monospace', fontSize:'9px', fontWeight:700,
              letterSpacing:'0.10em', textTransform:'uppercase',
              padding:'2px 8px', borderRadius:'4px',
              color:'#00FF88', background:'rgba(0,255,136,0.08)',
              border:'1px solid rgba(0,255,136,0.2)',
            }}>LIVE</span>
          )}
        </div>
        <p style={{ margin:0, fontSize:'11px', color:T.muted }}>
          Live attack origins · IP geolocation · 3D globe overlay
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ padding:'10px 14px', borderRadius:'7px', marginBottom:'14px',
          background:'rgba(255,61,113,0.08)', border:'1px solid rgba(255,61,113,0.25)',
          fontFamily:'monospace', fontSize:'11px', color:T.red }}>⚠ {error}</div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'16px' }}>
        <KpiCard label="Total Events"  value={stats.total}     color={T.cyan}   loading={loading} />
        <KpiCard label="Countries"     value={stats.countries} color='#a78bfa'  loading={loading} />
        <KpiCard label="Critical"      value={stats.critical}  color={T.red}    loading={loading} />
        <KpiCard label="High"          value={stats.high}      color={T.orange} loading={loading} />
        <KpiCard label="TOR / Proxy"   value={stats.tor}       color={T.muted}  loading={loading} />
      </div>

      {/* ── 3D Globe ── */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:'10px',
        overflow:'hidden', marginBottom:'16px', position:'relative' }}>

        {/* map header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 16px', borderBottom:`1px solid ${T.borderD}` }}>
          <span style={{ fontSize:'11px', color:T.cyan, textTransform:'uppercase',
            letterSpacing:'0.12em' }}>Live Threat Globe</span>
          <div style={{ display:'flex', gap:'14px', alignItems:'center' }}>
            {Object.entries(SEV).map(([k, v]) => (
              <span key={k} style={{ fontSize:'10px', color:v.color,
                display:'flex', alignItems:'center', gap:'4px' }}>
                <span style={{ width:'7px', height:'7px', borderRadius:'50%',
                  background:v.color, display:'inline-block' }} />{k}
              </span>
            ))}
            <span style={{ fontSize:'10px', color:T.muted }}>
              {mapped} dot{mapped !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* canvas */}
        <div style={{ height:'460px', width:'100%', background:'#0D1117', cursor:'grab' }}>
          <Canvas
            camera={{ position: [0, 0, 2.6], fov: 45 }}
            gl={{ antialias: true, alpha: false }}
            style={{ background:'#0D1117' }}
          >
            <Suspense fallback={null}>
              <GlobeScene
                attacks={attacks}
                onHover={setHovered}
                onSelect={handleSelect}
                hovered={hovered}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* hover tooltip */}
        {hovered && (
          <div style={{ position:'absolute', bottom:'16px', left:'16px', pointerEvents:'none',
            background:'rgba(13,17,23,0.92)', border:`1px solid ${sevStyle(hovered.severity).border}`,
            borderRadius:'8px', padding:'10px 14px', fontFamily:'monospace', fontSize:'11px' }}>
            <div style={{ fontWeight:700, color:sevStyle(hovered.severity).color,
              marginBottom:'4px' }}>{hovered.ip}</div>
            <div style={{ color:T.text }}>
              {hovered.city ? `${hovered.city}, ` : ''}{hovered.country}
            </div>
            <div style={{ color:T.muted, marginTop:'3px' }}>
              {hovered.type} · {hovered.severity} · {hovered.count} event{hovered.count !== 1 ? 's' : ''}
            </div>
            {(hovered.isTor || hovered.isProxy) && (
              <div style={{ marginTop:'4px', display:'flex', gap:'6px' }}>
                {hovered.isTor   && <span style={{ color:T.red,   fontSize:'9px',fontWeight:700 }}>TOR EXIT</span>}
                {hovered.isProxy && <span style={{ color:T.orange,fontSize:'9px',fontWeight:700 }}>OPEN PROXY</span>}
              </div>
            )}
          </div>
        )}

        {/* empty hint */}
        {mapped === 0 && !loading && (
          <div style={{ position:'absolute', bottom:'16px', left:'50%',
            transform:'translateX(-50%)', fontFamily:'monospace', fontSize:'11px',
            color:T.muted, background:'rgba(13,17,23,0.85)', padding:'6px 14px',
            borderRadius:'6px', pointerEvents:'none', whiteSpace:'nowrap' }}>
            No geo-located events — fire an attack on /simulate to populate the globe
          </div>
        )}
      </div>

      {/* ── Attack origins feed ── */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`,
        borderRadius:'10px', overflow:'hidden', marginBottom:'14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 16px', borderBottom:`1px solid ${T.borderD}` }}>
          <span style={{ fontSize:'11px', color:T.cyan, textTransform:'uppercase',
            letterSpacing:'0.12em' }}>Attack Origins Feed</span>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <span style={{ fontSize:'10px', color:T.muted }}>
              {loading ? 'Loading…' : `${attacks.length} unique source${attacks.length !== 1 ? 's' : ''}`}
            </span>
            <button onClick={load} disabled={loading}
              style={{ fontFamily:'monospace', fontSize:'10px', color:T.cyan,
                background:'rgba(0,245,255,0.06)', border:`1px solid ${T.border}`,
                borderRadius:'5px', padding:'3px 10px', cursor:'pointer',
                opacity: loading ? 0.4 : 1 }}>↺ Refresh</button>
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
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[140,120,100,70,40,60].map((w, j) => (
                      <td key={j} style={{ padding:'10px 14px' }}>
                        <div style={{ height:'11px', borderRadius:'3px', width:`${w}px`,
                          background:'rgba(0,245,255,0.05)',
                          animation:'shimmer 1.5s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : attacks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding:'36px', textAlign:'center', color:T.muted }}>
                    No attacks recorded yet — fire a simulation on /simulate
                  </td>
                </tr>
              ) : attacks.map(a => (
                <tr key={a.id}
                  onClick={() => handleSelect(a)}
                  style={{
                    borderTop:`1px solid ${T.borderD}`,
                    cursor:'pointer',
                    background: selected?.id === a.id ? sevStyle(a.severity).bg : 'transparent',
                    transition:'background 120ms',
                  }}
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
                  <td style={{ padding:'9px 14px', fontSize:'10px', display:'flex', gap:'4px', alignItems:'center' }}>
                    {a.isTor    && <span style={{ color:T.red,    fontWeight:700 }}>TOR</span>}
                    {a.isProxy  && <span style={{ color:T.orange, fontWeight:700 }}>PROXY</span>}
                    {a.lat != null && <span style={{ color:T.green }} title="Geo-located">●</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Selected IP detail panel ── */}
      {selected && (
        <div style={{
          background:T.surface,
          border:`1px solid ${sevStyle(selected.severity).border}`,
          borderRadius:'10px', padding:'16px 20px',
          animation:'slideUp 160ms ease',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'flex-start', marginBottom:'14px' }}>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:T.cyan,
                letterSpacing:'0.04em' }}>{selected.ip}</div>
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
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'12px' }}>
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
        @keyframes shimmer  { 0%,100%{opacity:.4} 50%{opacity:.9} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}
