/** ThreatScanner — Stage 1 skeleton
 * Radar-style rotating scanner added in Stage 2.
 */
export default function ThreatScanner() {
  return (
    <section className="section">
      <div className="container">
        <div className="terminal-badge" style={{ marginBottom: '1rem' }}>IDS ENGINE</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '1rem' }}>Threat Detection Radar</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          The Nexus AI Agent continuously scans all traffic patterns.
          Anomalies are detected, classified, and routed to the response queue — with Gemini AI explanation.
        </p>
        <div style={{
          height: 400, borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(255,184,0,0.15)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)',
          letterSpacing: '0.1em',
        }}>[ RADAR SCANNER — STAGE 2 ]</div>
      </div>
    </section>
  );
}
