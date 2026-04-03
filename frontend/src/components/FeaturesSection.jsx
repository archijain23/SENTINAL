import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initFeatureCardsStagger } from '../animations/scrollAnimations';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    id: 'detection',
    label: 'AI Threat Detection',
    sublabel: 'SYS.DETECT',
    color: '#00F5FF',
    desc: 'Transformer-based model classifies every request in under 2 ms. Trained on 2.4 million real attack signatures including zero-days and novel CVEs.',
    stat: '99.7%',
    statLabel: 'Accuracy',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    id: 'shield',
    label: 'Adaptive Rate Limiting',
    sublabel: 'SYS.SHIELD',
    color: '#00FF88',
    desc: 'Dynamic rate limits that adapt to traffic patterns. Credential stuffing, DDoS and API abuse stopped before they breach your origin.',
    stat: '< 1ms',
    statLabel: 'Block latency',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'nexus',
    label: 'Nexus Policy Engine',
    sublabel: 'SYS.NEXUS',
    color: '#FFB800',
    desc: 'No-code rule builder meets code-level power. Chain conditions, set priorities, and simulate rule impact before deploying to production.',
    stat: '3,200+',
    statLabel: 'Rules/tenant',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
      </svg>
    ),
  },
  {
    id: 'telemetry',
    label: 'Live Telemetry',
    sublabel: 'SYS.TELEMETRY',
    color: '#00F5FF',
    desc: 'Sub-second event streaming to your SOC dashboard. Full request/response context, geo attribution, and analyst annotation in one pane.',
    stat: '48k',
    statLabel: 'Req/sec',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'action',
    label: 'Action Queue',
    sublabel: 'SYS.RESPONSE',
    color: '#A259FF',
    desc: 'Ordered dispatch bus for Block, Challenge, Log, Alert and Allow actions. Human-in-the-loop approvals integrated directly into the queue.',
    stat: 'P99 < 2ms',
    statLabel: 'Dispatch latency',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
  {
    id: 'compliance',
    label: 'Compliance Reporting',
    sublabel: 'SYS.AUDIT',
    color: '#FF3D71',
    desc: 'PCI-DSS, SOC 2, GDPR and HIPAA audit reports generated automatically. Every policy decision is logged, signed, and exportable.',
    stat: '6 frameworks',
    statLabel: 'Supported',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    if (!sectionRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Section header reveal
    gsap.fromTo(
      sectionRef.current.querySelector('.features-header'),
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 82%', toggleActions: 'play none none none' },
      }
    );

    // Cards stagger
    initFeatureCardsStagger(gridRef);
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      aria-label="SENTINAL platform features"
      className="relative py-32 overflow-hidden"
    >
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="features-header mb-20">
          <p className="text-xs tracking-[0.3em] text-cyber-blue font-mono uppercase mb-3">
            SYS.CAPABILITIES — PLATFORM v4.2
          </p>
          <h2 className="text-3xl font-display font-bold text-white">
            Built for Threats That
            <br />
            <span className="text-cyber-blue">Don't Exist Yet</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl text-sm leading-relaxed">
            Six tightly integrated modules working as one system.
            No duct tape. No vendor sprawl.
          </p>
        </div>

        {/* Feature grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {FEATURES.map((f) => (
            <article
              key={f.id}
              className="feature-card glass-panel rounded-xl p-6 group relative overflow-hidden"
              style={{
                transition: 'box-shadow 220ms ease, transform 220ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 0 1px ${f.color}33, 0 8px 32px ${f.color}18`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '';
                e.currentTarget.style.transform = '';
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${f.color}88, transparent)` }}
                aria-hidden="true"
              />

              {/* Icon */}
              <div
                className="w-10 h-10 flex items-center justify-center rounded-lg mb-5"
                style={{ background: `${f.color}12`, color: f.color, border: `1px solid ${f.color}22` }}
              >
                {f.icon}
              </div>

              {/* Label */}
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: f.color }}>
                {f.sublabel}
              </p>

              <h3 className="text-sm font-display font-bold text-white mb-3">{f.label}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-5">{f.desc}</p>

              {/* Stat */}
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-display font-bold tabular-nums" style={{ color: f.color }}>
                  {f.stat}
                </span>
                <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{f.statLabel}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
