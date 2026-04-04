/** NetworkTopology — Stage 1 skeleton
 * Three.js graph with animated packet flow added in Stage 2.
 */
export default function NetworkTopology() {
  return (
    <section id="threat-intel" className="section">
      <div className="container">
        <div className="terminal-badge" style={{ marginBottom: '1rem' }}>NETWORK GRAPH</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '1rem' }}>Live Network Topology</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          Real-time visualization of packet flow across your infrastructure.
          Attack vectors flash red. Blocked routes fade. Policy enforcement shown live.
        </p>
        <div style={{
          height: 480, borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)',
          letterSpacing: '0.1em',
        }}>[ 3D TOPOLOGY GRAPH — STAGE 2 ]</div>
      </div>
    </section>
  );
}
