import React, { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import MainScene from '../scenes/MainScene'

gsap.registerPlugin(ScrollTrigger)

const THREAT_STREAM = [
  { id: 'THR-4821', type: 'SQL Injection',     source: '185.234.x.x',   severity: 'CRITICAL', status: 'BLOCKED',   time: '00:00:01' },
  { id: 'THR-4822', type: 'XSS Attack',        source: '92.118.x.x',    severity: 'HIGH',     status: 'BLOCKED',   time: '00:00:03' },
  { id: 'THR-4823', type: 'Port Scan',         source: '103.21.x.x',    severity: 'MEDIUM',   status: 'ANALYZING', time: '00:00:06' },
  { id: 'THR-4824', type: 'DDoS Probe',        source: '45.33.x.x',     severity: 'HIGH',     status: 'BLOCKED',   time: '00:00:09' },
  { id: 'THR-4825', type: 'LFI Attempt',       source: '178.62.x.x',    severity: 'CRITICAL', status: 'BLOCKED',   time: '00:00:12' },
]

const SEVERITY_COLORS = {
  CRITICAL: '#FF3D71',
  HIGH:     '#FFB700',
  MEDIUM:   '#00F5FF',
  LOW:      '#9B5DE5',
}

const STATUS_COLORS = {
  BLOCKED:   '#00FF88',
  ANALYZING: '#FFB700',
  ALLOWED:   '#00F5FF',
}

export default function HeroScene({ reducedMotion }) {
  const sectionRef  = useRef()
  const headlineRef = useRef()
  const subRef      = useRef()
  const statsRef    = useRef()
  const tableRef    = useRef()

  useEffect(() => {
    if (reducedMotion) return

    const ctx = gsap.context(() => {
      // Headline stagger reveal
      gsap.fromTo(
        headlineRef.current?.querySelectorAll('.reveal-line'),
        { y: 30, opacity: 0, clipPath: 'inset(100% 0 0 0)' },
        { y: 0, opacity: 1, clipPath: 'inset(0% 0 0 0)',
          stagger: 0.12, duration: 0.9, ease: 'power3.out', delay: 0.8 }
      )

      gsap.fromTo(subRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 1.4 }
      )

      gsap.fromTo(statsRef.current?.querySelectorAll('.stat-item'),
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.1, duration: 0.6, ease: 'power2.out', delay: 1.7 }
      )

      gsap.fromTo(tableRef.current,
        { x: 40, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 1.2 }
      )
    }, sectionRef)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      id="hero"
      ref={sectionRef}
      aria-label="SENTINAL hero — live threat monitoring command interface"
      className="relative min-h-screen flex items-center overflow-hidden bg-cyber-grid"
      style={{ backgroundSize: '40px 40px' }}
    >
      {/* 3D canvas background */}
      <div className="absolute inset-0" aria-hidden="true">
        <MainScene showTopology showShield={false} showScanner={false} />
        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 70% 50%, transparent 30%, rgba(11,15,25,0.85) 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(to bottom, transparent, #0B0F19)', pointerEvents: 'none' }}
        />
      </div>

      {/* Content */}
      <div className="section-container relative z-10 pt-28 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">

        {/* Left — Command info */}
        <div>
          {/* System status badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="badge-live">
              <span className="live-dot" />
              SYSTEM ACTIVE
            </div>
            <span className="label-terminal">SENTINAL v2.4.1</span>
          </div>

          {/* Headline */}
          <h1 ref={headlineRef} className="font-mono mb-6" style={{ fontSize: 'var(--text-3xl)', lineHeight: 1.1 }}>
            <span className="reveal-line block text-white">AI-Powered</span>
            <span className="reveal-line block" style={{ color: 'var(--cyber-blue)' }}>Threat Defense</span>
            <span className="reveal-line block text-white">At Network Edge</span>
          </h1>

          {/* Descriptor */}
          <p
            ref={subRef}
            className="mb-8 leading-relaxed"
            style={{ fontSize: 'var(--text-base)', color: 'var(--text-muted)', maxWidth: '52ch' }}
          >
            SENTINAL autonomously detects, classifies, and neutralizes web-layer attacks
            in real time — combining a Layer-7 WAF with AI-driven intrusion detection
            for enterprise infrastructure.
          </p>

          {/* Stats bar */}
          <div ref={statsRef} className="grid grid-cols-3 gap-4 mb-8">
            {[
              { value: '< 2ms',   label: 'Detection Latency' },
              { value: '99.97%',  label: 'Uptime SLA'        },
              { value: '3.2M/s',  label: 'Events Processed'  },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="stat-item glass-panel p-3 text-center"
              >
                <div className="metric-display text-lg mb-1">{value}</div>
                <div className="label-terminal text-[10px]">{label}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <a href="#cta" className="btn-cyber">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Deploy SENTINAL
            </a>
            <a href="#architecture" className="btn-ghost-cyber">
              View Architecture
            </a>
          </div>
        </div>

        {/* Right — Live threat feed */}
        <div ref={tableRef}>
          {/* Terminal header */}
          <div className="glass-panel overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-cyber)' }}
            >
              <div className="flex items-center gap-2">
                <div className="alert-dot" />
                <span className="font-mono text-xs tracking-[0.1em] uppercase" style={{ color: 'var(--cyber-blue)' }}>
                  LIVE THREAT FEED
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>Updates: real-time</span>
                <div className="live-dot" />
              </div>
            </div>

            {/* Column headers */}
            <div
              className="grid font-mono text-[10px] tracking-[0.12em] uppercase px-4 py-2"
              style={{
                gridTemplateColumns: '1fr 1.5fr 1.2fr 0.8fr 0.8fr',
                color: 'var(--text-faint)',
                borderBottom: '1px solid var(--border-cyber-2)',
              }}
            >
              <span>ID</span>
              <span>ATTACK TYPE</span>
              <span>SOURCE IP</span>
              <span>SEVERITY</span>
              <span>STATUS</span>
            </div>

            {/* Threat rows */}
            <div className="scanline-overlay" aria-label="Live threat detection events">
              {THREAT_STREAM.map((threat, i) => (
                <div
                  key={threat.id}
                  className="grid font-mono text-xs px-4 py-2.5 transition-colors hover:bg-[rgba(0,245,255,0.03)]"
                  style={{
                    gridTemplateColumns: '1fr 1.5fr 1.2fr 0.8fr 0.8fr',
                    borderBottom: '1px solid var(--border-cyber-2)',
                    opacity: 1 - i * 0.1,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{threat.id}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{threat.type}</span>
                  <span style={{ color: 'var(--cyber-blue-dim)' }}>{threat.source}</span>
                  <span style={{ color: SEVERITY_COLORS[threat.severity], fontWeight: 600 }}>{threat.severity}</span>
                  <span
                    style={{
                      color: STATUS_COLORS[threat.status],
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    {threat.status === 'BLOCKED' && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    )}
                    {threat.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: '1px solid var(--border-cyber-2)' }}
            >
              <span className="font-mono text-[10px]" style={{ color: 'var(--text-faint)' }}>
                SENTINAL-ENGINE — AI MODEL v4.1
              </span>
              <span className="font-mono text-[10px]" style={{ color: 'var(--cyber-green)' }}>
                5 events · all classified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        aria-hidden="true"
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--text-faint)' }}>Scroll</span>
        <div
          className="w-px h-8 animate-pulse"
          style={{ background: 'linear-gradient(to bottom, var(--cyber-blue), transparent)' }}
        />
      </div>
    </section>
  )
}
