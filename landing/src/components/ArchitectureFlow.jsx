/** ArchitectureFlow — Stage 1 skeleton
 * Animated SENTINAL pipeline diagram added in Stage 2.
 */
const PIPELINE = [
  { id: 'gateway',    label: 'API Gateway',        port: ':3000', color: '#00ff88' },
  { id: 'detection',  label: 'Detection Engine',   port: ':5001', color: '#4fc3f7' },
  { id: 'nexus',      label: 'Nexus AI Agent',     port: ':5003', color: '#ffb800' },
  { id: 'response',   label: 'Response Engine',    port: ':5004', color: '#ff3d71' },
  { id: 'dashboard',  label: 'SOC Dashboard',      port: ':5173', color: '#00ff88' },
];

export default function ArchitectureFlow() {
  return (
    <section id="deploy" className="section">
      <div className="container">
        <div className="terminal-badge" style={{ marginBottom: '1rem' }}>SYSTEM ARCHITECTURE</div>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '0.75rem' }}>The SENTINAL Pipeline</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '3rem' }}>
          Five coordinated microservices. Every request is inspected, classified, and actioned automatically.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
          {PIPELINE.map((node, i) => (
            <div key={node.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                minWidth: 160, padding: '1rem 1.25rem',
                background: 'var(--color-surface-2)',
                border: `1px solid ${node.color}22`,
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: node.color, margin: '0 auto 0.5rem', boxShadow: `0 0 8px ${node.color}` }} />
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.2rem' }}>{node.label}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', fontFamily: 'monospace' }}>{node.port}</div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div style={{ padding: '0 0.5rem', color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)' }}>→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
