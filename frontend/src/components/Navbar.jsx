import React, { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Link } from 'react-router-dom'

gsap.registerPlugin(ScrollTrigger)

const NAV_LINKS = [
  { label: 'Architecture', href: '#architecture' },
  { label: 'Detection',    href: '#detection'    },
  { label: 'Monitoring',   href: '#monitoring'   },
  { label: 'Dashboard',   href: '#dashboard'    },
  { label: 'Deploy',       href: '#cta'          },
]

export default function Navbar() {
  const navRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    ScrollTrigger.create({
      start: 'top -60',
      onEnter:     () => setScrolled(true),
      onLeaveBack: () => setScrolled(false),
    })
    gsap.fromTo(nav,
      { y: -20, opacity: 0 },
      { y: 0,   opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.3 }
    )
    return () => ScrollTrigger.getAll().forEach(t => t.kill())
  }, [])

  const handleKeyDown = (e) => { if (e.key === 'Escape') setIsOpen(false) }

  return (
    <header
      ref={navRef}
      role="banner"
      onKeyDown={handleKeyDown}
      style={{ opacity: 0 }}
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'py-3 bg-[rgba(11,15,25,0.95)] backdrop-blur-xl border-b border-[rgba(0,245,255,0.08)] shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'py-5 bg-transparent',
      ].join(' ')}
    >
      {/*
        Skip-to-content link — visually hidden at all times except when
        focused via keyboard Tab. Uses fixed positioning so it never
        pushes layout or flashes as visible text on mouse load.
        The sr-only class in globals.css hides it; on :focus-visible it
        becomes a small pill anchored to the top-left corner.
      */}
    

      <div className="section-container flex items-center justify-between">

        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group" aria-label="SENTINAL — Home">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"
            className="transition-all duration-300 group-hover:[filter:drop-shadow(0_0_8px_#00F5FF)]">
            <rect width="32" height="32" rx="4" fill="#0D1117" />
            <path d="M16 4L26 9V17C26 22.523 21.523 27 16 28C10.477 27 6 22.523 6 17V9L16 4Z"
              fill="none" stroke="#00F5FF" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M11.5 16.5L14.5 19.5L21 13" stroke="#00F5FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="1.5" fill="#00F5FF" opacity="0.6" />
          </svg>
          <div>
            <div className="font-mono font-bold text-sm tracking-[0.15em] uppercase text-white leading-none">SENTINAL</div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-[#00F5FF] uppercase opacity-70">WAF · IDS</div>
          </div>
        </a>

        {/* Desktop nav links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={href} href={href}
              className="font-mono text-xs tracking-[0.1em] uppercase text-[#6B7894]
                hover:text-[#00F5FF] px-3 py-2 rounded transition-colors duration-200
                hover:bg-[rgba(0,245,255,0.05)] relative group">
              {label}
              <span className="absolute bottom-0 left-3 right-3 h-px bg-[#00F5FF] scale-x-0
                group-hover:scale-x-100 transition-transform duration-200 origin-left" />
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <span className="live-dot" />
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#00FF88]">System Active</span>
          </div>

          <Link
            to="/app/dashboard"
            className="hidden md:inline-flex items-center gap-2 font-mono text-xs tracking-[0.1em] uppercase px-4 py-2 rounded transition-all duration-200"
            style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', color: '#00F5FF' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(0,245,255,0.15)'; e.currentTarget.style.boxShadow='0 0 16px rgba(0,245,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(0,245,255,0.08)'; e.currentTarget.style.boxShadow='none' }}
            aria-label="Launch the SENTINAL dashboard"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C17.5 22.15 21 17.25 21 12V6L12 2z" strokeLinejoin="round"/>
            </svg>
            Launch Dashboard
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 border border-[rgba(0,245,255,0.12)] rounded"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className={`w-5 h-px bg-[#00F5FF] transition-all duration-200 ${isOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-5 h-px bg-[#00F5FF] transition-all duration-200 ${isOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-px bg-[#00F5FF] transition-all duration-200 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div id="mobile-menu" role="dialog" aria-label="Mobile navigation" aria-hidden={!isOpen}
        className={['md:hidden overflow-hidden transition-all duration-300', isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'].join(' ')}>
        <nav className="section-container pb-4 flex flex-col gap-1" aria-label="Mobile navigation links">
          {NAV_LINKS.map(({ label, href }) => (
            <a key={href} href={href} onClick={() => setIsOpen(false)}
              className="font-mono text-sm tracking-[0.1em] uppercase text-[#6B7894]
                hover:text-[#00F5FF] px-3 py-3 rounded hover:bg-[rgba(0,245,255,0.05)]
                transition-colors duration-200 border-b border-[rgba(0,245,255,0.06)] last:border-none">
              {label}
            </a>
          ))}
          <Link to="/app/dashboard" onClick={() => setIsOpen(false)}
            className="font-mono text-sm tracking-[0.1em] uppercase px-3 py-3 rounded mt-1 text-center transition-colors duration-200"
            style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)', color: '#00F5FF' }}>
            🛡 Launch Dashboard
          </Link>
        </nav>
      </div>
    </header>
  )
}
