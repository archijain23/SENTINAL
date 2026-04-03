import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scanWave } from '../animations/packetAnimations';

gsap.registerPlugin(ScrollTrigger);

export default function CTA() {
  const sectionRef  = useRef(null);
  const headlineRef = useRef(null);
  const ring1Ref    = useRef(null);
  const ring2Ref    = useRef(null);
  const ring3Ref    = useRef(null);
  const ctaBtnRef   = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // Headline reveal — immediateRender:false keeps it visible until trigger fires
      gsap.fromTo(
        headlineRef.current,
        { opacity: 0, y: 50 },
        {
          opacity: 1, y: 0, duration: 1, ease: 'power3.out',
          immediateRender: false,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 72%' },
        }
      );

      // CTA button glow pulse (no ScrollTrigger — runs immediately on mount)
      gsap.to(ctaBtnRef.current, {
        boxShadow: '0 0 40px rgba(0,245,255,0.5), 0 0 80px rgba(0,245,255,0.2)',
        duration: 1.8,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }, sectionRef);

    // Scan wave rings (staggered start)
    const timeouts = [ring1Ref, ring2Ref, ring3Ref].map((ref, i) =>
      setTimeout(() => { if (ref.current) scanWave(ref.current); }, i * 600)
    );

    return () => {
      timeouts.forEach(clearTimeout);
      ctx.revert(); // only kills THIS section’s ScrollTriggers
    };
  }, []);

  return (
    <section
      id="contact"
      ref={sectionRef}
      aria-label="Get started with SENTINAL"
      className="relative py-40 overflow-hidden flex items-center justify-center"
    >
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" aria-hidden="true" />

      {/* Radial scan rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
          <div
            key={i}
            ref={ref}
            className="absolute rounded-full border"
            style={{ width: `${300 + i * 200}px`, height: `${300 + i * 200}px`, borderColor: 'rgba(0,245,255,0.08)' }}
          />
        ))}
      </div>

      {/* Corner brackets */}
      {[
        ['top-8 left-8',    'border-t border-l'],
        ['top-8 right-8',   'border-t border-r'],
        ['bottom-8 left-8', 'border-b border-l'],
        ['bottom-8 right-8','border-b border-r'],
      ].map(([pos, borders], i) => (
        <div key={i} className={`absolute ${pos} w-10 h-10 ${borders} border-cyber-blue/30`} aria-hidden="true" />
      ))}

      <div ref={headlineRef} className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-cyber-blue font-mono uppercase mb-6">
          DEPLOY.SENTINAL // ENTERPRISE TRIAL
        </p>

        <h2 className="text-4xl lg:text-6xl font-display font-black text-white leading-tight mb-6">
          Secure Your
          <br />
          <span className="text-cyber-blue" style={{ textShadow: '0 0 40px rgba(0,245,255,0.5)' }}>
            Infrastructure
          </span>
          <br />
          Today.
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed max-w-lg mx-auto mb-12">
          Deploy SENTINAL in under 15 minutes. No agents. No infrastructure
          changes. Full WAF + IDS coverage from the first packet.
        </p>

        {/* Deployment specs */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { label: 'Deploy Time',    value: '< 15 min' },
            { label: 'Agent Required', value: 'None'     },
            { label: 'SLA Uptime',     value: '99.99%'   },
          ].map((spec) => (
            <div key={spec.label} className="glass-panel rounded-xl px-4 py-5">
              <p className="text-2xl font-display font-bold text-cyber-blue mb-1 tabular-nums">{spec.value}</p>
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{spec.label}</p>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            ref={ctaBtnRef}
            href="#contact"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-lg font-mono text-sm font-bold text-[#0B0F19] uppercase tracking-widest transition-transform duration-200 hover:scale-105 focus:scale-105"
            style={{ background: '#00F5FF', boxShadow: '0 0 20px rgba(0,245,255,0.3)' }}
            aria-label="Start free enterprise trial of SENTINAL"
          >
            <span>Start Free Trial</span>
            <span aria-hidden="true">→</span>
          </a>
          <a
            href="#dashboard"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-lg font-mono text-sm font-bold text-cyber-blue uppercase tracking-widest transition-all duration-200 hover:bg-cyber-blue/10 focus:bg-cyber-blue/10"
            style={{ border: '1px solid rgba(0,245,255,0.3)' }}
            aria-label="See the dashboard demo"
          >
            See Demo
          </a>
        </div>

        <p className="mt-10 text-[10px] font-mono text-gray-700 uppercase tracking-widest">
          SOC-2 TYPE II &nbsp;·&nbsp; ISO 27001 &nbsp;·&nbsp; GDPR COMPLIANT &nbsp;·&nbsp; FedRAMP READY
        </p>
      </div>
    </section>
  );
}
