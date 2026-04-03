import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { pulseAlert } from '../animations/scrollAnimations';

gsap.registerPlugin(ScrollTrigger);

// ─── Data ──────────────────────────────────────────────────────────────────────
const SPARKLINE_PTS = [
  [0,52],[7,48],[14,65],[20,42],[27,78],[33,58],[40,88],[46,52],[53,70],[60,44],[67,82],[74,55],[80,74],[87,62],[93,80],[100,60],
];

const LIVE_METRICS = [
  { label: 'Requests / sec',   value: '62,481', unit: 'rps',        color: '#00F5FF', trend: '+18%',    up: true  },
  { label: 'Threats Blocked',  value: '3,219',  unit: 'last 1h',    color: '#FF3D71', trend: '↑ 14%',   up: false },
  { label: 'Avg Latency',      value: '1.2',    unit: 'ms P99',     color: '#00FF88', trend: '-0.3ms',  up: true  },
  { label: 'Indian IPs Seen',  value: '18,742', unit: 'unique/hr',  color: '#FFB800', trend: '+6%',     up: true  },
];

// India-specific: sectors targeted
const SECTORS = [
  { name: 'Banking & UPI',     pct: 38, color: '#FF3D71', icon: '🏦' },
  { name: 'Govt Portals',      pct: 26, color: '#FFB800', icon: '🏛️' },
  { name: 'Telecom & ISPs',    pct: 17, color: '#A259FF', icon: '📡' },
  { name: 'E-Commerce',        pct: 12, color: '#00F5FF', icon: '🛒' },
  { name: 'Healthcare IT',     pct: 7,  color: '#00FF88', icon: '🏥' },
];

// Attack types India-specific
const ATTACK_TYPES = [
  { type: 'UPI / OTP Fraud',       pct: 36, color: '#FF3D71' },
  { type: 'SQL Injection',          pct: 24, color: '#FFB800' },
  { type: 'Credential Stuffing',    pct: 18, color: '#FF8C00' },
  { type: 'DDoS (State-actor)',     pct: 13, color: '#A259FF' },
  { type: 'API Scraping',           pct: 9,  color: '#00F5FF' },
];

// Threat origins targeting India
const GEO_ATTACKS = [
  { country: 'China',         code: 'CN', flag: '🇨🇳', pct: 38, count: '1,221', color: '#FF3D71' },
  { country: 'Pakistan',      code: 'PK', flag: '🇵🇰', pct: 27, count: '869',   color: '#FF8C00' },
  { country: 'Russia',        code: 'RU', flag: '🇷🇺', pct: 16, count: '514',   color: '#FFB800' },
  { country: 'North Korea',   code: 'KP', flag: '🇰🇵', pct: 12, count: '385',   color: '#A259FF' },
  { country: 'United States', code: 'US', flag: '🇺🇸', pct: 7,  count: '225',   color: '#00F5FF' },
];

// Live event feed (India-focused IPs / orgs)
const LIVE_EVENTS = [
  { time: '09:41:02', type: 'UPI Credential Stuffing', src: '101.0.70.12',    city: 'Beijing, CN',   sev: 'CRITICAL', blocked: true  },
  { time: '09:41:05', type: 'SQL Injection',            src: '103.255.4.118',  city: 'Karachi, PK',   sev: 'HIGH',     blocked: true  },
  { time: '09:41:09', type: 'IDOR on Aadhaar API',      src: '45.142.212.10',  city: 'Moscow, RU',    sev: 'CRITICAL', blocked: true  },
  { time: '09:41:11', type: 'DDoS — 48 Gbps',          src: '175.45.176.0',   city: 'Pyongyang, KP', sev: 'HIGH',     blocked: true  },
  { time: '09:41:14', type: 'OTP Bypass Attempt',       src: '103.21.244.88',  city: 'Lahore, PK',    sev: 'MEDIUM',   blocked: true  },
  { time: '09:41:17', type: 'Govt Portal Scrape',       src: '122.114.56.200', city: 'Shanghai, CN',  sev: 'LOW',      blocked: false },
];

const SEV_COLOR = { CRITICAL: '#FF3D71', HIGH: '#FF8C00', MEDIUM: '#FFB800', LOW: '#00F5FF' };

// India map threat dots [cx%, cy%] — approximate lat/lon mapped to SVG
const INDIA_THREATS = [
  { city: 'Mumbai',    cx: 27, cy: 62, hits: 842, color: '#FF3D71'  },
  { city: 'Delhi',     cx: 34, cy: 32, hits: 731, color: '#FF3D71'  },
  { city: 'Bengaluru', cx: 34, cy: 74, hits: 518, color: '#FFB800'  },
  { city: 'Chennai',   cx: 38, cy: 80, hits: 392, color: '#FFB800'  },
  { city: 'Hyderabad', cx: 36, cy: 68, hits: 314, color: '#A259FF'  },
  { city: 'Kolkata',   cx: 57, cy: 48, hits: 276, color: '#00F5FF'  },
  { city: 'Pune',      cx: 28, cy: 65, hits: 198, color: '#00FF88'  },
  { city: 'Ahmedabad', cx: 23, cy: 48, hits: 156, color: '#FFB800'  },
];

function buildSparkPath(pts, w = 300, h = 60) {
  return pts.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'}${(x / 100) * w},${h - (y / 100) * h}`
  ).join(' ');
}

// ─── India SVG Map ─────────────────────────────────────────────────────────────
function IndiaThreatMap() {
  const dotsRef = useRef([]);
  const ringsRef = useRef([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    dotsRef.current.filter(Boolean).forEach((dot, i) => {
      gsap.fromTo(dot,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', delay: 0.4 + i * 0.12,
          scrollTrigger: { trigger: dot, start: 'top 90%' } }
      );
    });
    ringsRef.current.filter(Boolean).forEach((ring, i) => {
      gsap.to(ring, {
        scale: 3.5, opacity: 0, duration: 1.8, ease: 'power2.out',
        repeat: -1, delay: i * 0.35, transformOrigin: 'center',
      });
    });
  }, []);

  return (
    <div
      className="relative w-full h-full"
      role="img"
      aria-label="India threat origin map showing attack concentrations by city"
    >
      {/* Simplified India outline SVG */}
      <svg viewBox="0 0 100 110" className="w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00F5FF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#00F5FF" stopOpacity="0" />
          </radialGradient>
          <filter id="dot-glow">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* India simplified outline */}
        <path
          d="M 28 5 L 38 4 L 48 8 L 58 6 L 65 12 L 68 20 L 72 28 L 70 36 L 65 42 L 68 50
             L 65 58 L 58 68 L 52 78 L 46 88 L 42 98 L 38 105 L 35 98 L 30 88 L 26 78
             L 22 68 L 18 58 L 15 48 L 14 38 L 16 28 L 18 20 L 22 14 Z"
          fill="rgba(0,245,255,0.04)"
          stroke="rgba(0,245,255,0.25)"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {/* Sri Lanka */}
        <ellipse cx="42" cy="105" rx="3" ry="4" fill="rgba(0,245,255,0.03)" stroke="rgba(0,245,255,0.15)" strokeWidth="0.5" />

        <rect width="100" height="110" fill="url(#map-glow)" />

        {/* Threat dots */}
        {INDIA_THREATS.map((t, i) => (
          <g key={t.city} filter="url(#dot-glow)" style={{ transformOrigin: `${t.cx}px ${t.cy}px` }}>
            {/* Pulse ring */}
            <circle
              ref={el => (ringsRef.current[i] = el)}
              cx={t.cx} cy={t.cy} r="2"
              fill="none"
              stroke={t.color}
              strokeWidth="0.5"
              opacity="0.6"
              style={{ transformOrigin: `${t.cx}px ${t.cy}px` }}
            />
            {/* Dot */}
            <circle
              ref={el => (dotsRef.current[i] = el)}
              cx={t.cx} cy={t.cy} r="1.8"
              fill={t.color}
              opacity="0.9"
              style={{ transformOrigin: `${t.cx}px ${t.cy}px` }}
            />
          </g>
        ))}

        {/* City labels */}
        {INDIA_THREATS.map((t) => (
          <text
            key={`lbl-${t.city}`}
            x={t.cx + 2.5} y={t.cy + 0.8}
            fontSize="3.2"
            fill="rgba(255,255,255,0.55)"
            fontFamily="monospace"
          >
            {t.city}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Animated KPI counter ───────────────────────────────────────────────────────
function KPICard({ m }) {
  const valRef  = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!cardRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
        immediateRender: false,
        scrollTrigger: { trigger: cardRef.current, start: 'top 88%' } }
    );
  }, []);

  return (
    <div ref={cardRef} className="glass-panel rounded-xl p-5 relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${m.color}66, transparent)` }}
        aria-hidden="true"
      />
      <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest mb-2">{m.label}</p>
      <p ref={valRef} className="text-2xl font-display font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] font-mono text-gray-600">{m.unit}</span>
        <span className="text-[9px] font-mono" style={{ color: m.up === true ? '#00FF88' : m.up === false ? '#FF3D71' : '#4a5568' }}>
          {m.trend}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function MonitoringSection() {
  const sectionRef   = useRef(null);
  const headerRef    = useRef(null);
  const alertDotRef  = useRef(null);
  const barsRef      = useRef([]);
  const geoRef       = useRef([]);
  const tickerRef    = useRef(null);
  const sparkRef     = useRef(null);
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // Header
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 82%' } }
      );

      // Attack type bars
      gsap.fromTo(
        barsRef.current.filter(Boolean),
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 68%' } }
      );

      // Geo bars
      gsap.fromTo(
        geoRef.current.filter(Boolean),
        { scaleX: 0, transformOrigin: 'left center' },
        { scaleX: 1, duration: 0.7, stagger: 0.09, ease: 'power2.out',
          immediateRender: false, delay: 0.2,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 62%' } }
      );

      // Sparkline draw
      if (sparkRef.current) {
        const len = sparkRef.current.getTotalLength?.() ?? 300;
        gsap.set(sparkRef.current, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(sparkRef.current, {
          strokeDashoffset: 0, duration: 1.6, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 78%' },
        });
      }

      // Ticker scroll
      if (tickerRef.current) {
        gsap.to(tickerRef.current, {
          xPercent: -50, duration: 22, ease: 'none', repeat: -1,
        });
      }
    }, sectionRef);

    if (alertDotRef.current) pulseAlert(alertDotRef.current);

    return () => ctx.revert();
  }, []);

  const sparkPath = buildSparkPath(SPARKLINE_PTS);

  return (
    <section
      id="monitoring"
      ref={sectionRef}
      aria-label="SENTINAL real-time monitoring — India threat intelligence"
      className="relative py-32 overflow-hidden"
    >
      {/* BG */}
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" aria-hidden="true" />
      <div
        className="absolute top-0 right-0 w-[50vw] h-[50vh] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(255,61,113,0.05) 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">

        {/* ── Header ── */}
        <div ref={headerRef} className="mb-14">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-xs tracking-[0.3em] text-cyber-blue font-mono uppercase">
              SYS.TELEMETRY — LIVE STREAM
            </p>
            <span className="flex items-center gap-1.5 text-[9px] font-mono text-green-400 px-2 py-0.5 rounded-full bg-green-400/10 border border-green-400/20">
              <span ref={alertDotRef} className="w-1.5 h-1.5 rounded-full bg-green-400" />
              LIVE
            </span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-white leading-tight">
            Real-Time Threat
            <br />
            <span className="text-cyber-blue">Intelligence Feed</span>
          </h2>
          <p className="mt-3 text-gray-400 max-w-xl text-sm leading-relaxed">
            India-focused threat telemetry. Every malicious packet targeting Indian infrastructure
            is classified, blocked, and logged in under 2ms.
          </p>

          {/* India Shield badge */}
          <div className="mt-5 inline-flex items-center gap-4 glass-panel rounded-xl px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">🇮🇳</span>
              <div>
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">India Shield Status</p>
                <p className="text-sm font-bold text-green-400 font-display">ALL SYSTEMS PROTECTED</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">CERT-In Compliant</p>
              <p className="text-sm font-bold text-cyber-blue font-display">IT Act 2000 · DPDP 2023</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Breach Cost Saved</p>
              <p className="text-sm font-bold text-white font-display">₹19.5 Cr <span className="text-[10px] text-gray-500">/ hr</span></p>
            </div>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {LIVE_METRICS.map((m) => <KPICard key={m.label} m={m} />)}
        </div>

        {/* ── Scrolling ticker ── */}
        <div
          className="mb-8 overflow-hidden rounded-lg relative"
          style={{ border: '1px solid rgba(255,61,113,0.15)', background: 'rgba(255,61,113,0.04)' }}
          aria-label="Live threat event ticker"
        >
          <div className="flex items-center">
            <span
              className="shrink-0 text-[9px] font-mono text-alert px-3 py-2 border-r border-red-500/20 uppercase tracking-widest"
              style={{ color: '#FF3D71', background: 'rgba(255,61,113,0.12)' }}
            >
              ⚡ LIVE
            </span>
            <div className="overflow-hidden flex-1">
              <div ref={tickerRef} className="flex gap-0 whitespace-nowrap py-2">
                {[...LIVE_EVENTS, ...LIVE_EVENTS].map((ev, i) => (
                  <span key={i} className="inline-flex items-center gap-3 px-6 text-[10px] font-mono">
                    <span style={{ color: SEV_COLOR[ev.sev] }}>●</span>
                    <span className="text-gray-500">{ev.time}</span>
                    <span className="text-white">{ev.type}</span>
                    <span className="text-cyber-blue">{ev.src}</span>
                    <span className="text-gray-600">{ev.city}</span>
                    <span className="text-gray-700 mx-2">│</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Sparkline */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-6" role="img" aria-label="Indian request volume sparkline">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-display font-bold text-white">Indian Traffic Volume</p>
                <p className="text-[9px] font-mono text-gray-600 mt-0.5">Last 15 min — threats blocked highlighted</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[9px] font-mono text-red-400"><span style={{color:'#FF3D71'}}>●</span> Spike</span>
                <span className="flex items-center gap-1 text-[9px] font-mono text-cyber-blue"><span>●</span> Normal</span>
              </div>
            </div>
            <div className="relative h-24 w-full">
              <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
                <defs>
                  <linearGradient id="spark-fill-in" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F5FF" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#00F5FF" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="spark-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00F5FF" />
                    <stop offset="65%" stopColor="#00F5FF" />
                    <stop offset="80%" stopColor="#FF3D71" />
                    <stop offset="100%" stopColor="#FF3D71" />
                  </linearGradient>
                  <filter id="spark-glow">
                    <feGaussianBlur stdDeviation="1.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <path d={`${sparkPath} L300,60 L0,60 Z`} fill="url(#spark-fill-in)" />
                <path
                  ref={sparkRef}
                  d={sparkPath}
                  fill="none"
                  stroke="url(#spark-stroke)"
                  strokeWidth="1.8"
                  filter="url(#spark-glow)"
                />
                {/* Spike marker at ~80% X = 240 */}
                <circle cx="240" cy="8" r="3" fill="#FF3D71" />
                <line x1="240" y1="8" x2="240" y2="60" stroke="#FF3D71" strokeWidth="0.5" strokeDasharray="2 3" />
                <text x="242" y="13" fontSize="4" fill="#FF3D71" fontFamily="monospace">DDoS BURST</text>

                {/* Current value dot */}
                <circle cx="300" cy="24" r="3" fill="#00F5FF" style={{ filter: 'drop-shadow(0 0 4px #00F5FF)' }} />
              </svg>
            </div>
            <div className="flex justify-between mt-2">
              {['-15m', '-12m', '-9m', '-6m', '-3m', 'NOW'].map((t) => (
                <span key={t} className="text-[8px] font-mono text-gray-700">{t}</span>
              ))}
            </div>
          </div>

          {/* Attack breakdown — India-specific */}
          <div className="glass-panel rounded-xl p-6">
            <p className="text-xs font-display font-bold text-white mb-1">Attack Vectors</p>
            <p className="text-[9px] font-mono text-gray-600 mb-5">India-specific — last 1h</p>
            <div className="space-y-4">
              {ATTACK_TYPES.map((a, i) => (
                <div key={a.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-gray-400">{a.type}</span>
                    <span className="text-[10px] font-mono" style={{ color: a.color }}>{a.pct}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      ref={(el) => (barsRef.current[i] = el)}
                      className="h-full rounded-full"
                      style={{ width: `${a.pct}%`, background: a.color, boxShadow: `0 0 6px ${a.color}88` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* India Threat Map */}
          <div className="lg:col-span-1 glass-panel rounded-xl p-6 flex flex-col">
            <p className="text-xs font-display font-bold text-white mb-1">🇮🇳 India Threat Heatmap</p>
            <p className="text-[9px] font-mono text-gray-600 mb-4">Active attack targets — city-level</p>
            <div className="flex-1 min-h-[220px] relative">
              <IndiaThreatMap />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1">
              {INDIA_THREATS.slice(0, 4).map((t) => (
                <div key={t.city} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="text-[9px] font-mono text-gray-500">{t.city}</span>
                  <span className="text-[9px] font-mono ml-auto" style={{ color: t.color }}>{t.hits}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sectors under attack */}
          <div className="glass-panel rounded-xl p-6">
            <p className="text-xs font-display font-bold text-white mb-1">Sectors Targeted</p>
            <p className="text-[9px] font-mono text-gray-600 mb-5">Indian critical infrastructure — last 24h</p>
            <div className="space-y-3.5">
              {SECTORS.map((s, i) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-gray-300 flex items-center gap-1.5">
                      <span>{s.icon}</span>{s.name}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      ref={(el) => (barsRef.current[ATTACK_TYPES.length + i] = el)}
                      className="h-full rounded-full"
                      style={{ width: `${s.pct}%`, background: s.color, boxShadow: `0 0 6px ${s.color}88` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Origin countries */}
          <div className="glass-panel rounded-xl p-6">
            <p className="text-xs font-display font-bold text-white mb-1">Threat Origins</p>
            <p className="text-[9px] font-mono text-gray-600 mb-5">Countries targeting India — blocked requests</p>
            <div className="space-y-4">
              {GEO_ATTACKS.map((geo, i) => (
                <div key={geo.code}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-gray-300 flex items-center gap-2">
                      <span>{geo.flag}</span>{geo.country}
                    </span>
                    <span className="text-[10px] font-mono text-gray-500">{geo.count}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      ref={(el) => (geoRef.current[i] = el)}
                      className="h-full rounded-full"
                      style={{ width: `${geo.pct}%`, background: `linear-gradient(90deg, ${geo.color}, ${geo.color}66)`, boxShadow: `0 0 6px ${geo.color}55` }}
                    />
                  </div>
                  <p className="text-[9px] font-mono text-gray-700 mt-0.5">{geo.pct}% of blocked traffic</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live event feed */}
          <div className="lg:col-span-3 glass-panel rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-6 py-3"
              style={{ borderBottom: '1px solid rgba(255,61,113,0.1)', background: 'rgba(255,61,113,0.04)' }}
            >
              <p className="text-xs font-display font-bold text-white">Live Threat Events — India Infra</p>
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {LIVE_EVENTS.length} events shown
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono" aria-label="Live India-targeting threat events">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {['TIME (IST)', 'THREAT TYPE', 'SOURCE IP', 'ORIGIN CITY', 'SEVERITY', 'ACTION'].map((h) => (
                      <th key={h} scope="col" className="px-5 py-3 text-left text-[9px] tracking-widest text-gray-600 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LIVE_EVENTS.map((ev, i) => (
                    <tr
                      key={i}
                      onClick={() => setActiveEvent(activeEvent === i ? null : i)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    >
                      <td className="px-5 py-3 text-gray-500">{ev.time}</td>
                      <td className="px-5 py-3 text-white font-medium">{ev.type}</td>
                      <td className="px-5 py-3 text-cyber-blue">{ev.src}</td>
                      <td className="px-5 py-3 text-gray-400">{ev.city}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold" style={{ color: SEV_COLOR[ev.sev] }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEV_COLOR[ev.sev] }} />
                          {ev.sev}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold tracking-widest"
                          style={ev.blocked
                            ? { color: '#FF3D71', border: '1px solid #FF3D7144', background: '#FF3D7111' }
                            : { color: '#00FF88', border: '1px solid #00FF8844', background: '#00FF8811' }
                          }
                        >
                          {ev.blocked ? 'BLOCKED' : 'LOGGED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className="px-6 py-2 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-[9px] font-mono text-gray-700">Showing 6 of 3,219 blocked this hour</span>
              <span className="text-[9px] font-mono text-gray-700">🇮🇳 CERT-In incident log synced · Updated 09:41 IST</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
