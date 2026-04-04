/** DefenseShield — Stage 1 skeleton
 * Holographic shield WebGL model added in Stage 2.
 */
export default function DefenseShield() {
  return (
    <section id="architecture" className="section">
      <div className="container">
        <div className="terminal-badge" style={{ marginBottom: '1rem' }}>FIREWALL ENGINE</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '1rem' }}>Active Defense Shield</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          SENTINAL’s WAF engine inspects every HTTP/S request at wire speed.
          Malformed packets, injection payloads, and rate-limit violations are blocked before they reach your app.
        </p>
        <div style={{
          height: 400, borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(79,195,247,0.15)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)',
          letterSpacing: '0.1em',
        }}>[ HOLOGRAPHIC SHIELD — STAGE 2 ]</div>
      </div>
    </section>
  );
}
