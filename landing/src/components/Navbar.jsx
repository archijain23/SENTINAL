/** Navbar — Stage 1 skeleton */
export default function Navbar() {
  return (
    <nav className="navbar" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(1rem, 4vw, 3rem)',
      height: '64px',
      background: 'rgba(6,8,16,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,255,136,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="SENTINAL logo">
          <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#00ff88" strokeWidth="1.5" fill="none"/>
          <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" stroke="#00ff88" strokeWidth="1" fill="rgba(0,255,136,0.08)"/>
          <circle cx="14" cy="14" r="2.5" fill="#00ff88"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.12em', color: '#e2e8f0' }}>SENTINAL</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', letterSpacing: '0.1em', fontFamily: 'var(--font-body)' }}>AI-WAF + IDS</span>
      </div>
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        {['System', 'Threat Intel', 'Architecture', 'Deploy'].map(item => (
          <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
            style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', transition: 'color var(--transition)' }}
            onMouseEnter={e => e.target.style.color = 'var(--color-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}>
            {item}
          </a>
        ))}
        <a href="/dashboard" style={{
          padding: '0.4rem 1.25rem',
          background: 'var(--color-primary-dim)',
          border: '1px solid var(--color-primary-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-primary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          letterSpacing: '0.06em',
        }}>LAUNCH DASHBOARD →</a>
      </div>
    </nav>
  );
}
