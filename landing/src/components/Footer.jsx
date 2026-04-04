/** Footer — Stage 1 skeleton */
export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--color-divider)',
      padding: 'var(--space-8) clamp(1rem,4vw,3rem)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 'var(--text-xs)',
      color: 'var(--color-text-faint)',
      fontFamily: 'var(--font-body)',
      letterSpacing: '0.06em',
    }}>
      <span>SENTINAL — AI-POWERED WAF + IDS</span>
      <span>BUILT INCREMENTALLY — PRODUCTION GRADE</span>
    </footer>
  );
}
