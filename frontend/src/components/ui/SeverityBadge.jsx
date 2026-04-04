import styles from './SeverityBadge.module.css';

const CONFIG = {
  critical: { color: '#FF3D71', bg: 'rgba(255,61,113,0.12)',  border: 'rgba(255,61,113,0.3)',  glow: '0 0 6px rgba(255,61,113,0.4)' },
  high:     { color: '#FF8C00', bg: 'rgba(255,140,0,0.12)',   border: 'rgba(255,140,0,0.3)',   glow: '0 0 6px rgba(255,140,0,0.4)'  },
  medium:   { color: '#FFD700', bg: 'rgba(255,215,0,0.10)',   border: 'rgba(255,215,0,0.25)',  glow: 'none' },
  low:      { color: '#00FF88', bg: 'rgba(0,255,136,0.08)',   border: 'rgba(0,255,136,0.2)',   glow: 'none' },
  info:     { color: '#00F5FF', bg: 'rgba(0,245,255,0.08)',   border: 'rgba(0,245,255,0.2)',   glow: 'none' },
};

export default function SeverityBadge({ level = 'info' }) {
  const cfg = CONFIG[level?.toLowerCase()] ?? CONFIG.info;
  return (
    <span
      className={styles.badge}
      style={{
        color:       cfg.color,
        background:  cfg.bg,
        border:      `1px solid ${cfg.border}`,
        boxShadow:   cfg.glow,
      }}
    >
      <span className={styles.dot} style={{ background: cfg.color }} />
      {level?.toUpperCase()}
    </span>
  );
}
