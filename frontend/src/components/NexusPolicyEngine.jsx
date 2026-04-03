import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const POLICY_RULES = [
  { id: 'NX-001', name: 'OWASP-SQLi-Union',            type: 'SIGNATURE', priority: 1,  action: 'BLOCK',      hits: '12,441', enabled: true,  color: '#FF3D71' },
  { id: 'NX-002', name: 'GeoFence-Sanctioned-Countries', type: 'GEO',       priority: 2,  action: 'BLOCK',      hits: '8,203',  enabled: true,  color: '#FF3D71' },
  { id: 'NX-003', name: 'RateLimit-Auth-Endpoint',       type: 'RATE',      priority: 3,  action: 'RATE_LIMIT', hits: '4,819',  enabled: true,  color: '#00F5FF' },
  { id: 'NX-004', name: 'ML-Anomaly-Score-High',         type: 'ML',        priority: 4,  action: 'CHALLENGE',  hits: '3,102',  enabled: true,  color: '#FFB800' },
  { id: 'NX-005', name: 'BotDetection-Headless-UA',      type: 'BEHAVIORAL',priority: 5,  action: 'HONEYPOT',   hits: '2,667',  enabled: true,  color: '#A259FF' },
  { id: 'NX-006', name: 'TrustList-Internal-CIDR',       type: 'ALLOWLIST', priority: 99, action: 'ALLOW',      hits: '—',      enabled: true,  color: '#00FF88' },
];

const DECISION_STEPS = [
  { label: 'Allowlist',  desc: 'Trusted CIDRs bypass all checks',    outcome: 'ALLOW',     color: '#00FF88' },
  { label: 'Geo Block',  desc: 'Sanctioned country origin check',     outcome: 'BLOCK',     color: '#FF3D71' },
  { label: 'Signature',  desc: 'OWASP / known attack patterns',       outcome: 'BLOCK',     color: '#FF3D71' },
  { label: 'Rate Limit', desc: 'Volume anomaly detection',            outcome: 'LIMIT',     color: '#00F5FF' },
  { label: 'ML Score',   desc: 'Transformer anomaly model',           outcome: 'SCORE',     color: '#FFB800' },
  { label: 'Behavioral', desc: 'Bot + fingerprint analysis',          outcome: 'CHALLENGE', color: '#A259FF' },
  { label: 'Default',    desc: 'No rule matched — allow',             outcome: 'ALLOW',     color: '#00FF88' },
];

const TYPE_COLOR = {
  SIGNATURE: '#FF3D71',
  GEO:       '#FF8C00',
  RATE:      '#00F5FF',
  ML:        '#FFB800',
  BEHAVIORAL:'#A259FF',
  ALLOWLIST: '#00FF88',
};

export default function NexusPolicyEngine() {
  const sectionRef = useRef(null);
  const stepsRef   = useRef([]);
  const rulesRef   = useRef([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // Section reveal
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0, y: 60 },
        {
          opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        }
      );

      // Decision steps cascade
      gsap.fromTo(
        stepsRef.current.filter(Boolean),
        { opacity: 0, x: -20 },
        {
          opacity: 1, x: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 72%' },
        }
      );

      // Rule rows stagger
      gsap.fromTo(
        rulesRef.current.filter(Boolean),
        { opacity: 0, y: 20 },
        {
          opacity: 1, y: 0, duration: 0.4, stagger: 0.07, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%' },
        }
      );

      // Animate hit counter numbers
      rulesRef.current.filter(Boolean).forEach((row) => {
        const counter = row.querySelector('[data-counter]');
        if (!counter || counter.dataset.counter === '—') return;
        const target = parseInt(counter.dataset.counter.replace(/,/g, ''), 10);
        if (isNaN(target)) return;
        gsap.from(
          { val: 0 },
          {
            val: target,
            duration: 1.5,
            ease: 'power2.out',
            delay: 0.4,
            immediateRender: false,
            scrollTrigger: { trigger: sectionRef.current, start: 'top 65%' },
            onUpdate() {
              counter.textContent = Math.floor(this._targets[0].val).toLocaleString();
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="nexus"
      ref={sectionRef}
      aria-label="SENTINAL Nexus Policy Engine"
      className="relative py-32 overflow-hidden"
    >
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <p className="text-xs tracking-[0.3em] text-amber-400 font-mono uppercase mb-3">
            SYS.POLICY — NEXUS ENGINE v3
          </p>
          <h2 className="text-3xl font-display font-bold text-white">
            Deterministic Policy
            <br />
            <span style={{ color: '#FFB800' }}>Compilation Engine</span>
          </h2>
          <p className="mt-4 text-gray-400 text-sm leading-relaxed max-w-xl">
            Thousands of rules, threat-intel feeds and ML verdicts compiled into
            a single ordered decision chain. Zero ambiguity. Full auditability.
            Sub-millisecond evaluation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Decision chain */}
          <div className="glass-panel rounded-xl p-6">
            <p className="text-xs font-display font-bold text-white mb-1">Decision Chain</p>
            <p className="text-[9px] font-mono text-gray-600 mb-6">Evaluation order per request</p>

            <div className="relative">
              <div
                className="absolute left-[1.1rem] top-4 bottom-4 w-px"
                style={{ background: 'linear-gradient(180deg, rgba(0,245,255,0.3), rgba(0,245,255,0.05))' }}
                aria-hidden="true"
              />
              <ol className="space-y-3" aria-label="Policy decision steps">
                {DECISION_STEPS.map((step, i) => (
                  <li
                    key={step.label}
                    ref={(el) => (stepsRef.current[i] = el)}
                    className="relative flex items-start gap-4"
                  >
                    <div
                      className="shrink-0 w-[1.375rem] h-[1.375rem] rounded-full flex items-center justify-center text-[8px] font-mono font-bold mt-0.5 z-10"
                      style={{
                        background: `${step.color}18`,
                        border: `1px solid ${step.color}44`,
                        color: step.color,
                      }}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-mono font-bold text-white">{step.label}</p>
                        <span
                          className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ color: step.color, background: `${step.color}18` }}
                        >
                          {step.outcome}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-gray-600 mt-0.5">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8 pt-5 border-t border-white/5 grid grid-cols-2 gap-4">
              {[
                { label: 'Eval Time',   value: '0.4ms' },
                { label: 'Active Rules',value: '3,204' },
                { label: 'Rule Groups', value: '48'    },
                { label: 'Daily Evals', value: '4.2B'  },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-base font-display font-bold text-cyber-blue tabular-nums">{s.value}</p>
                  <p className="text-[8px] font-mono text-gray-600 uppercase tracking-widest mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Active rule table */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-display font-bold text-white">Active Policy Rules</p>
              <span className="text-[9px] font-mono text-gray-600">Sorted by priority — 3,204 total</span>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(0,245,255,0.08)', background: 'rgba(11,15,25,0.8)' }}
            >
              <div
                className="grid text-[9px] font-mono text-gray-600 uppercase tracking-widest px-5 py-3"
                style={{
                  gridTemplateColumns: '3rem 1fr 6rem 5rem 6rem 4rem 3rem',
                  borderBottom: '1px solid rgba(0,245,255,0.06)',
                  background: 'rgba(0,245,255,0.02)',
                }}
              >
                {['PRI', 'RULE NAME', 'TYPE', 'ACTION', 'HITS (24h)', 'ON', ''].map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>

              {POLICY_RULES.map((rule, i) => (
                <div
                  key={rule.id}
                  ref={(el) => (rulesRef.current[i] = el)}
                  className="grid items-center px-5 py-3.5 transition-colors duration-200 hover:bg-white/[0.02]"
                  style={{
                    gridTemplateColumns: '3rem 1fr 6rem 5rem 6rem 4rem 3rem',
                    borderBottom: i < POLICY_RULES.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  }}
                  role="row"
                >
                  <span className="text-[10px] font-mono text-gray-600 tabular-nums">{String(rule.priority).padStart(2, '0')}</span>
                  <div>
                    <p className="text-[10px] font-mono text-white font-medium">{rule.name}</p>
                    <p className="text-[8px] font-mono text-gray-600 mt-0.5">{rule.id}</p>
                  </div>
                  <span
                    className="text-[8px] font-mono font-bold px-2 py-0.5 rounded w-fit"
                    style={{ color: TYPE_COLOR[rule.type], background: `${TYPE_COLOR[rule.type]}18`, border: `1px solid ${TYPE_COLOR[rule.type]}33` }}
                  >
                    {rule.type}
                  </span>
                  <span className="text-[9px] font-mono font-bold" style={{ color: rule.color }}>{rule.action}</span>
                  <span className="text-[10px] font-mono tabular-nums text-gray-400" data-counter={rule.hits}>{rule.hits}</span>
                  <div
                    className="w-7 h-4 rounded-full relative"
                    style={{
                      background: rule.enabled ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${rule.enabled ? '#00FF88' : 'rgba(255,255,255,0.1)'}`,
                    }}
                    role="img"
                    aria-label={rule.enabled ? 'Rule enabled' : 'Rule disabled'}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300"
                      style={{
                        left: rule.enabled ? '0.75rem' : '0.1rem',
                        background: rule.enabled ? '#00FF88' : 'rgba(255,255,255,0.2)',
                        boxShadow: rule.enabled ? '0 0 4px #00FF88' : 'none',
                      }}
                    />
                  </div>
                  <button
                    className="text-gray-700 hover:text-gray-400 transition-colors text-xs"
                    aria-label={`Options for rule ${rule.name}`}
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[9px] font-mono text-gray-700">
              Showing 6 of 3,204 active rules — sorted by evaluation priority
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
