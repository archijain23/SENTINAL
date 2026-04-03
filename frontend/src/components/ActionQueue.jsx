import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { flashAttackNode, shieldImpactRipple } from '../animations/packetAnimations';

gsap.registerPlugin(ScrollTrigger);

const QUEUE_ITEMS = [
  {
    id: 'AQ-9841',
    type: 'BLOCK',
    threat: 'SQL Injection — Union-based',
    src: '185.220.101.47',
    confidence: 99,
    severity: 'CRITICAL',
    auto: true,
    status: 'EXECUTED',
    color: '#FF3D71',
  },
  {
    id: 'AQ-9842',
    type: 'CHALLENGE',
    threat: 'Credential Stuffing — Low Velocity',
    src: '194.165.16.65',
    confidence: 87,
    severity: 'MEDIUM',
    auto: false,
    status: 'PENDING_APPROVAL',
    color: '#FFB800',
  },
  {
    id: 'AQ-9843',
    type: 'BLOCK',
    threat: 'XSS — DOM Clobbering Pattern',
    src: '92.118.160.12',
    confidence: 96,
    severity: 'HIGH',
    auto: true,
    status: 'EXECUTED',
    color: '#FF3D71',
  },
  {
    id: 'AQ-9844',
    type: 'RATE_LIMIT',
    threat: 'API Scraping — Endpoint Enumeration',
    src: '103.21.244.0',
    confidence: 72,
    severity: 'LOW',
    auto: false,
    status: 'PENDING_APPROVAL',
    color: '#00F5FF',
  },
  {
    id: 'AQ-9845',
    type: 'HONEYPOT',
    threat: 'Path Traversal — Known Pattern',
    src: '45.155.205.10',
    confidence: 94,
    severity: 'HIGH',
    auto: true,
    status: 'EXECUTED',
    color: '#A259FF',
  },
];

const ACTION_MODES = [
  { label: 'AUTO-BLOCK',  desc: 'Confidence ≥ 95%',  color: '#FF3D71', count: 2 },
  { label: 'CHALLENGE',   desc: 'Confidence 80–94%', color: '#FFB800', count: 1 },
  { label: 'RATE-LIMIT',  desc: 'Volume anomaly',    color: '#00F5FF', count: 1 },
  { label: 'HONEYPOT',    desc: 'Reconnaissance',    color: '#A259FF', count: 1 },
  { label: 'LOG & ALERT', desc: 'Low confidence',    color: '#4a5568', count: 0 },
  { label: 'ALLOW',       desc: 'Trusted sources',   color: '#00FF88', count: 0 },
];

export default function ActionQueue() {
  const sectionRef = useRef(null);
  const shieldRef  = useRef(null);
  const rippleRef  = useRef(null);
  const itemRefs   = useRef([]);
  const [approvedItems, setApprovedItems] = useState(new Set());

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // Section reveal — immediateRender:false keeps element visible until trigger fires
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0, y: 60 },
        {
          opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        }
      );

      // Stagger queue items
      gsap.fromTo(
        itemRefs.current.filter(Boolean),
        { opacity: 0, x: -30 },
        {
          opacity: 1, x: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        }
      );
    }, sectionRef);

    // Periodic shield ripple (runs regardless of scroll position)
    const interval = setInterval(() => {
      if (rippleRef.current)  shieldImpactRipple(rippleRef.current);
      itemRefs.current
        .filter((_, i) => QUEUE_ITEMS[i]?.severity === 'CRITICAL')
        .forEach((el) => el && flashAttackNode(el));
    }, 3000);

    return () => {
      clearInterval(interval);
      ctx.revert();
    };
  }, []);

  const handleApprove = (id) => {
    setApprovedItems((prev) => new Set([...prev, id]));
    const idx = QUEUE_ITEMS.findIndex((q) => q.id === id);
    if (itemRefs.current[idx]) {
      gsap.to(itemRefs.current[idx], {
        borderColor: '#00FF88',
        boxShadow: '0 0 20px rgba(0,255,136,0.3)',
        duration: 0.4,
      });
    }
  };

  return (
    <section
      id="action-queue"
      ref={sectionRef}
      aria-label="SENTINAL Action Queue Workflow"
      className="relative py-32 overflow-hidden"
    >
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-16">
          <p className="text-xs tracking-[0.3em] text-cyber-blue font-mono uppercase mb-3">
            SYS.RESPONSE — ACTION QUEUE ENGINE
          </p>
          <h2 className="text-3xl font-display font-bold text-white">
            Autonomous Response
            <br />
            <span className="text-cyber-blue">with Human Oversight</span>
          </h2>
          <p className="mt-4 text-gray-400 text-sm leading-relaxed max-w-xl">
            High-confidence threats are blocked automatically. Edge cases surface
            to your analyst queue for one-click approval — full context included.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Action mode matrix */}
          <div className="glass-panel rounded-xl p-6">
            <p className="text-xs font-display font-bold text-white mb-1">Response Modes</p>
            <p className="text-[9px] font-mono text-gray-600 mb-6">Action → confidence threshold mapping</p>
            <div className="space-y-3">
              {ACTION_MODES.map((mode) => (
                <div
                  key={mode.label}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                  style={{
                    background: `${mode.color}08`,
                    border: `1px solid ${mode.color}22`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: mode.color, boxShadow: `0 0 6px ${mode.color}` }}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[10px] font-mono font-bold" style={{ color: mode.color }}>
                        {mode.label}
                      </p>
                      <p className="text-[9px] font-mono text-gray-600">{mode.desc}</p>
                    </div>
                  </div>
                  {mode.count > 0 && (
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ color: mode.color, background: `${mode.color}22` }}
                    >
                      {mode.count}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Shield */}
            <div className="mt-8 flex flex-col items-center">
              <div
                ref={shieldRef}
                className="relative flex items-center justify-center"
                aria-label="Defense shield visualization"
              >
                <svg
                  width="80" height="90" viewBox="0 0 80 90"
                  fill="none" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 12px rgba(0,245,255,0.4))' }}
                >
                  <path
                    d="M40 4 L74 18 L74 46 C74 65 58 80 40 86 C22 80 6 65 6 46 L6 18 Z"
                    stroke="#00F5FF" strokeWidth="1.5" fill="rgba(0,245,255,0.05)"
                  />
                  <path
                    d="M40 14 L64 24 L64 46 C64 60 53 72 40 77 C27 72 16 60 16 46 L16 24 Z"
                    stroke="#00F5FF" strokeWidth="1" fill="rgba(0,245,255,0.03)" strokeOpacity="0.5"
                  />
                  <text x="40" y="50" textAnchor="middle" fill="#00F5FF" fontSize="18" fontFamily="monospace">⛨</text>
                </svg>
                <div
                  ref={rippleRef}
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: '#FF3D71' }}
                  aria-hidden="true"
                />
              </div>
              <p className="text-[9px] font-mono text-gray-600 mt-3 text-center">SHIELD ACTIVE — 0 BREACHES</p>
            </div>
          </div>

          {/* Right: Live queue */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-display font-bold text-white">Live Action Queue</p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                <span className="text-[9px] font-mono text-green-400">
                  {QUEUE_ITEMS.filter((q) => q.status === 'PENDING_APPROVAL').length} AWAITING APPROVAL
                </span>
              </div>
            </div>

            <div className="space-y-3" role="list" aria-label="Action queue items">
              {QUEUE_ITEMS.map((item, i) => (
                <div
                  key={item.id}
                  ref={(el) => (itemRefs.current[i] = el)}
                  className="relative rounded-xl p-5 transition-all duration-300"
                  style={{
                    background: 'rgba(11,15,25,0.8)',
                    border: `1px solid ${item.color}22`,
                  }}
                  role="listitem"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[9px] font-mono text-gray-600">{item.id}</span>
                        <span
                          className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                          style={{
                            color: item.color,
                            background: `${item.color}18`,
                            border: `1px solid ${item.color}33`,
                          }}
                        >
                          {item.type}
                        </span>
                        {item.auto && (
                          <span className="text-[9px] font-mono text-gray-600">AUTO</span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-white font-medium mb-1 truncate">{item.threat}</p>
                      <p className="text-[9px] font-mono text-gray-600">SRC: {item.src}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <p
                          className="text-sm font-display font-bold tabular-nums"
                          style={{ color: item.confidence >= 90 ? '#FF3D71' : item.color }}
                        >
                          {item.confidence}%
                        </p>
                        <p className="text-[8px] font-mono text-gray-600">confidence</p>
                      </div>
                      {item.status === 'EXECUTED' ? (
                        <span
                          className="text-[9px] font-mono px-2 py-1 rounded"
                          style={{ color: '#FF3D71', background: 'rgba(255,61,113,0.1)', border: '1px solid rgba(255,61,113,0.2)' }}
                        >
                          ✓ EXECUTED
                        </span>
                      ) : approvedItems.has(item.id) ? (
                        <span
                          className="text-[9px] font-mono px-2 py-1 rounded"
                          style={{ color: '#00FF88', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}
                        >
                          ✓ APPROVED
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="text-[9px] font-mono font-bold px-3 py-1.5 rounded transition-all duration-200 hover:scale-105"
                          style={{ color: '#FFB800', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)' }}
                          aria-label={`Approve action ${item.id} for ${item.threat}`}
                        >
                          APPROVE
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.confidence}%`, background: item.color, boxShadow: `0 0 4px ${item.color}` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
