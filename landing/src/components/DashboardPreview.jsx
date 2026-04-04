/** DashboardPreview — Stage 1 skeleton */
export default function DashboardPreview() {
  return (
    <section className="section">
      <div className="container">
        <div className="terminal-badge" style={{ marginBottom: '1rem' }}>SOC DASHBOARD</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '1rem' }}>Command & Control</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          A full-featured Security Operations Center dashboard.
          Real-time KPIs, threat stream, geo intel, blocklist management, and AI-powered forensics.
        </p>
        <div style={{
          height: 420, borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)',
          letterSpacing: '0.1em',
        }}>[ DASHBOARD SCREENSHOT — STAGE 3 ]</div>
      </div>
    </section>
  );
}
