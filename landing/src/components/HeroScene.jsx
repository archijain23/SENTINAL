/** HeroScene — Stage 1 skeleton
 * Full Three.js/R3F network topology added in Stage 2.
 */
export default function HeroScene() {
  return (
    <section id="system" className="section" style={{ minHeight: '100dvh', paddingTop: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="container">
        <div className="terminal-badge" style={{ marginBottom: '1.5rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block', animation: 'livePulse 2s ease-in-out infinite' }} />
          SYSTEM ACTIVE — MONITORING 0 THREATS
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-hero)', fontWeight: 800, lineHeight: 1.0, marginBottom: '1.5rem' }}>
          <span style={{ color: 'var(--color-text)' }}>NEXT-GEN</span><br/>
          <span style={{ color: 'var(--color-primary)' }}>AI-POWERED</span><br/>
          <span style={{ color: 'var(--color-text)' }}>DEFENSE</span>
        </h1>
        <p style={{ maxWidth: '56ch', color: 'var(--color-text-muted)', fontSize: 'var(--text-lg)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          SENTINAL combines a real-time Web Application Firewall with an AI Intrusion Detection System.
          Every packet inspected. Every threat classified. Every response enforced — in milliseconds.
        </p>
        <div style={{ display: 'flex', gap: '3rem', marginBottom: '3rem' }}>
          {[['&lt;2ms', 'DETECTION LATENCY'], ['99.97%', 'BLOCK ACCURACY'], ['11', 'ATTACK VECTORS']].map(([val, label]) => (
            <div key={label}>
              <div className="stat-value" dangerouslySetInnerHTML={{ __html: val }} />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', letterSpacing: '0.1em', marginTop: '0.25rem' }}>{label}</div>
            </div>
          ))}
        </div>
        {/* 3D canvas placeholder — NetworkTopology replaces this in Stage 2 */}
        <div style={{
          height: 320, borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)',
          letterSpacing: '0.1em',
        }}>[ 3D NETWORK TOPOLOGY — THREE.JS LOADING ]</div>
      </div>
    </section>
  );
}
