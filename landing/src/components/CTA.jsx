/** CTA — Stage 1 skeleton */
export default function CTA() {
  return (
    <section className="section">
      <div className="container" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginBottom: '1rem' }}>
          Deploy SENTINAL.<br/>
          <span style={{ color: 'var(--color-primary)' }}>Own your perimeter.</span>
        </h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2.5rem', margin: '0 auto 2.5rem' }}>
          Production-ready. Self-hosted. Full control.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a href="/dashboard" style={{
            padding: '0.75rem 2rem',
            background: 'var(--color-primary)',
            color: 'var(--color-bg)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            fontSize: 'var(--text-base)',
            letterSpacing: '0.06em',
          }}>LAUNCH DASHBOARD</a>
          <a href="https://github.com/archijain23/SENTINAL" target="_blank" rel="noopener noreferrer" style={{
            padding: '0.75rem 2rem',
            background: 'transparent',
            border: '1px solid var(--color-primary-border)',
            color: 'var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 'var(--text-base)',
          }}>VIEW ON GITHUB</a>
        </div>
      </div>
    </section>
  );
}
