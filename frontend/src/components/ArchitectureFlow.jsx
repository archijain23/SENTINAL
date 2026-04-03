import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ─── Pipeline data ────────────────────────────────────────────────────────────
const NODES = [
  {
    id: 'ingress',
    step: '01',
    label: 'Ingress Gateway',
    sublabel: 'Edge Layer',
    color: '#00F5FF',
    rgb: '0,245,255',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    latency: '0.12ms',
    latencyPct: 12,
    badges: ['TLS 1.3', 'HTTP/3', 'gRPC', 'WebSocket'],
    details: [
      'TLS termination + certificate pinning',
      'Geo-fence & IP reputation lookup',
      'Rate limiting: 50k req/s per cluster',
      'Connection coalescing & multiplexing',
    ],
  },
  {
    id: 'detection',
    step: '02',
    label: 'Detection Engine',
    sublabel: 'AI / ML Core',
    color: '#00F5FF',
    rgb: '0,245,255',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
    latency: '0.74ms',
    latencyPct: 46,
    badges: ['Transformer', 'OWASP', 'Zero-Day', 'Behavioural'],
    details: [
      'Transformer model: 384-dim embeddings',
      'OWASP Top-10 + zero-day heuristics',
      'Behavioural baseline per client fingerprint',
      'Inference time < 2ms P99 on GPU cluster',
    ],
  },
  {
    id: 'nexus',
    step: '03',
    label: 'Nexus Policy',
    sublabel: 'Rule Orchestrator',
    color: '#FFB800',
    rgb: '255,184,0',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    latency: '0.28ms',
    latencyPct: 22,
    badges: ['3,204 Rules', 'Threat Intel', 'ML Verdicts', 'Custom Logic'],
    details: [
      'Compiles 3,204+ customer-defined rules',
      'Merges threat-intel feeds (30+ sources)',
      'ML verdicts + deterministic rule fusion',
      'Hot-reload: policy changes in < 50ms',
    ],
  },
  {
    id: 'dispatch',
    step: '04',
    label: 'Action Dispatch',
    sublabel: 'Response Bus',
    color: '#A259FF',
    rgb: '162,89,255',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    latency: '0.08ms',
    latencyPct: 10,
    badges: ['Block', 'Challenge', 'Log', 'Alert'],
    details: [
      'Priority queue: P99 dispatch < 0.1ms',
      'Parallel fanout: WAF block + SIEM log',
      'CAPTCHA / JS challenge injection',
      'Webhook + PagerDuty + Slack alerts',
    ],
  },
  {
    id: 'soc',
    step: '05',
    label: 'SOC Dashboard',
    sublabel: 'Human Control Plane',
    color: '#00FF88',
    rgb: '0,255,136',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    ),
    latency: '< 1ms',
    latencyPct: 10,
    badges: ['Live Feed', 'Analyst Queue', 'Reporting', 'Tuning'],
    details: [
      'Single-pane SOC interface, < 1s refresh',
      'Analyst approval queue with full context',
      'Policy tuning with diff preview',
      'Executive PDF / API reporting export',
    ],
  },
];

const CONN_COLORS = [
  ['#00F5FF', '#00F5FF'],
  ['#00F5FF', '#FFB800'],
  ['#FFB800', '#A259FF'],
  ['#A259FF', '#00FF88'],
];

// ─── SVG Connector with animated dashes + arrow ───────────────────────────────
function AnimatedConnector({ idx, color }) {
  const lineRef  = useRef(null);
  const dashRef  = useRef(null);
  const arrowRef = useRef(null);
  const dotRef   = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const line  = lineRef.current;
    const dash  = dashRef.current;
    const arrow = arrowRef.current;
    const dot   = dotRef.current;
    if (!line || !dash || !arrow || !dot) return;

    // Draw the static line
    const len = line.getTotalLength?.() ?? 120;
    gsap.set(line, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
    gsap.to(line, {
      strokeDashoffset: 0, opacity: 1, duration: 0.7, ease: 'power2.out',
      delay: 0.3 + idx * 0.18,
      scrollTrigger: { trigger: line, start: 'top 80%' },
    });

    // Animate the travelling dash
    gsap.set(dash, { strokeDasharray: '10 14', strokeDashoffset: 0, opacity: 0.35 });
    gsap.to(dash, {
      strokeDashoffset: -240,
      duration: 1.6,
      ease: 'none',
      repeat: -1,
      delay: idx * 0.22,
    });

    // Arrow fade-in
    gsap.fromTo(arrow,
      { opacity: 0, scale: 0 },
      { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)', delay: 0.6 + idx * 0.18,
        scrollTrigger: { trigger: arrow, start: 'top 80%' } }
    );

    // Travelling packet dot
    gsap.set(dot, { opacity: 0 });
    const tl = gsap.timeline({ repeat: -1, delay: idx * 0.55 + 0.8 });
    tl.set(dot, { opacity: 1, motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5], start: 0, end: 0 } })
      .to(dot, {
        motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5], start: 0, end: 1 },
        duration: 1.4,
        ease: 'none',
      })
      .set(dot, { opacity: 0 })
      .to({}, { duration: 1.2 }); // pause before repeat
  }, [idx]);

  const [c1, c2] = CONN_COLORS[idx];
  const gradId = `conn-grad-${idx}`;

  return (
    <svg
      className="absolute top-[2.6rem] pointer-events-none overflow-visible"
      style={{
        left: `calc(${10 + idx * 20}% + 3.5rem)`,
        width: `calc(20% - 1.5rem)`,
        height: '24px',
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={c1} stopOpacity="0.9" />
          <stop offset="100%" stopColor={c2} stopOpacity="0.9" />
        </linearGradient>
        <marker id={`arrow-${idx}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={c2} opacity="0.9" />
        </marker>
      </defs>

      {/* Static base line */}
      <line
        ref={lineRef}
        x1="2" y1="12" x2="98%" y2="12"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Moving dashed overlay */}
      <line
        ref={dashRef}
        x1="2" y1="12" x2="98%" y2="12"
        stroke={c2}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0"
      />

      {/* Arrow head */}
      <line
        ref={arrowRef}
        x1="calc(98% - 8px)" y1="12" x2="98%" y2="12"
        stroke={c2}
        strokeWidth="1.5"
        markerEnd={`url(#arrow-${idx})`}
        opacity="0"
      />

      {/* Travelling packet dot */}
      <circle
        ref={dotRef}
        r="3.5"
        fill={c2}
        style={{ filter: `drop-shadow(0 0 4px ${c2})` }}
      />
    </svg>
  );
}

// ─── Single Pipeline Node ─────────────────────────────────────────────────────
function PipelineNode({ node, idx, active, onClick }) {
  const nodeRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = nodeRef.current;
    if (!el) return;

    gsap.fromTo(el,
      { opacity: 0, y: 32, scale: 0.88 },
      {
        opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'back.out(1.5)',
        immediateRender: false,
        delay: idx * 0.14,
        scrollTrigger: { trigger: el, start: 'top 82%' },
      }
    );

    // Continuous idle ring pulse
    gsap.to(ringRef.current, {
      scale: 1.6,
      opacity: 0,
      duration: 1.6,
      ease: 'power2.out',
      repeat: -1,
      repeatDelay: 0.8 + idx * 0.3,
    });
  }, [idx]);

  const isActive = active === node.id;

  return (
    <button
      ref={nodeRef}
      onClick={() => onClick(node.id)}
      className="arch-node group relative flex flex-col items-center text-center cursor-pointer outline-none focus:outline-none"
      aria-expanded={isActive}
      aria-label={`${node.label} — click to expand`}
    >
      {/* Step badge */}
      <span
        className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded"
        style={{
          color: node.color,
          border: `1px solid ${node.color}44`,
          background: `rgba(${node.rgb},0.07)`,
        }}
      >
        {node.step}
      </span>

      {/* Icon hexagon */}
      <div
        className="relative w-[4.5rem] h-[4.5rem] flex items-center justify-center rounded-xl mb-4 transition-all duration-300"
        style={{
          background: isActive
            ? `rgba(${node.rgb},0.18)`
            : `rgba(${node.rgb},0.07)`,
          border: `1px solid ${isActive ? node.color + 'aa' : node.color + '33'}`,
          boxShadow: isActive
            ? `0 0 32px rgba(${node.rgb},0.35), inset 0 0 20px rgba(${node.rgb},0.12)`
            : `0 0 16px rgba(${node.rgb},0.12)`,
          transform: isActive ? 'scale(1.08)' : 'scale(1)',
        }}
        aria-hidden="true"
      >
        {/* Pulse ring */}
        <div
          ref={ringRef}
          className="absolute inset-0 rounded-xl"
          style={{ border: `1px solid ${node.color}66`, transformOrigin: 'center' }}
          aria-hidden="true"
        />

        <span style={{ color: node.color }}>{node.icon}</span>

        {/* Active indicator dot */}
        {isActive && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: node.color, boxShadow: `0 0 8px ${node.color}` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Labels */}
      <h3 className="text-sm font-bold text-white font-display mb-0.5" style={{ letterSpacing: '0.04em' }}>
        {node.label}
      </h3>
      <p className="text-[10px] tracking-widest font-mono uppercase mb-2" style={{ color: node.color }}>
        {node.sublabel}
      </p>

      {/* Latency chip */}
      <span
        className="text-[9px] font-mono px-2 py-0.5 rounded-full"
        style={{
          color: node.color,
          background: `rgba(${node.rgb},0.1)`,
          border: `1px solid ${node.color}33`,
        }}
      >
        {node.latency}
      </span>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ node }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!panelRef.current) return;
    gsap.fromTo(panelRef.current,
      { opacity: 0, y: 16, height: 0 },
      { opacity: 1, y: 0, height: 'auto', duration: 0.45, ease: 'power3.out' }
    );
  }, [node.id]);

  return (
    <div
      ref={panelRef}
      className="mt-8 overflow-hidden rounded-2xl"
      style={{
        border: `1px solid ${node.color}33`,
        background: `rgba(${node.rgb},0.05)`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${node.color}1a` }}>
        <span style={{ color: node.color }}>{node.icon}</span>
        <div>
          <p className="text-sm font-bold text-white font-display">{node.label}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: node.color }}>{node.sublabel}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {node.badges.map((b) => (
            <span
              key={b}
              className="text-[9px] font-mono px-2 py-0.5 rounded-full"
              style={{ color: node.color, background: `rgba(${node.rgb},0.12)`, border: `1px solid ${node.color}33` }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {node.details.map((detail, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-6 py-3"
            style={{ borderBottom: i < node.details.length - 2 ? `1px solid ${node.color}0d` : 'none' }}
          >
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: node.color, boxShadow: `0 0 4px ${node.color}` }} aria-hidden="true" />
            <p className="text-xs text-gray-400 leading-relaxed">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ArchitectureFlow() {
  const sectionRef   = useRef(null);
  const headerRef    = useRef(null);
  const [active, setActive] = useState(null);

  const handleNodeClick = (id) => setActive((prev) => (prev === id ? null : id));
  const activeNode = NODES.find((n) => n.id === active);

  // Section reveal
  useEffect(() => {
    if (!sectionRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(headerRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      id="architecture"
      ref={sectionRef}
      aria-label="SENTINAL System Architecture"
      className="relative py-32 overflow-hidden"
    >
      {/* Background grid */}
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" aria-hidden="true" />

      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[40vh] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(0,245,255,0.04) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">

        {/* Header */}
        <div ref={headerRef} className="mb-20">
          <p className="text-xs tracking-[0.35em] text-cyber-blue font-mono uppercase mb-3">
            SYS.ARCHITECTURE — PIPELINE v4.2
          </p>
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-white leading-tight">
            How SENTINAL Processes
            <br />
            <span className="text-cyber-blue">Every Request</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl text-sm leading-relaxed">
            Five deterministic stages. Every packet classified, policy evaluated,
            and action dispatched — all before the handshake completes.
          </p>
          <p className="mt-3 text-[11px] font-mono text-gray-600 uppercase tracking-widest">
            ▸ Click any stage to inspect its internals
          </p>
        </div>

        {/* Pipeline */}
        <div className="relative">

          {/* SVG Connectors (desktop only) */}
          <div className="hidden lg:block">
            {[0, 1, 2, 3].map((i) => (
              <AnimatedConnector key={i} idx={i} color={CONN_COLORS[i]} />
            ))}
          </div>

          {/* Nodes grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-12 gap-x-4">
            {NODES.map((node, idx) => (
              <PipelineNode
                key={node.id}
                node={node}
                idx={idx}
                active={active}
                onClick={handleNodeClick}
              />
            ))}
          </div>

          {/* Mobile connector lines (vertical dots) */}
          <div className="lg:hidden flex flex-col items-center gap-1 my-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div className="w-px h-3 bg-cyber-blue/30" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyber-blue/50" />
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Detail Panel */}
        {activeNode && <DetailPanel key={activeNode.id} node={activeNode} />}

        {/* Latency waterfall */}
        <div className="mt-16 glass-panel rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
            <div>
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">END-TO-END LATENCY — P99 BREAKDOWN</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-display font-bold text-cyber-blue">&lt; 2</span>
                <span className="text-base text-gray-400 font-mono">ms total</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Throughput</p>
              <p className="text-lg font-display font-bold text-white mt-1">48,291 <span className="text-xs text-gray-500">req/s</span></p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-3">
            {NODES.map((node, i) => (
              <WaterfallBar key={node.id} node={node} idx={i} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

// ─── Waterfall Bar ────────────────────────────────────────────────────────────
function WaterfallBar({ node, idx }) {
  const barRef = useRef(null);

  useEffect(() => {
    if (!barRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(barRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      {
        scaleX: 1, duration: 0.6, ease: 'power3.out',
        immediateRender: false,
        delay: idx * 0.1,
        scrollTrigger: { trigger: barRef.current, start: 'top 95%' },
      }
    );
  }, [idx]);

  return (
    <div className="flex items-center gap-4">
      <span className="text-[10px] font-mono text-gray-500 w-32 shrink-0 text-right">{node.label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{
            width: `${node.latencyPct}%`,
            background: node.color,
            boxShadow: `0 0 8px ${node.color}88`,
          }}
        />
      </div>
      <span className="text-[10px] font-mono w-12 shrink-0" style={{ color: node.color }}>{node.latency}</span>
    </div>
  );
}
