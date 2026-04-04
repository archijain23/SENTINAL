import styles from './StatusDot.module.css';

const COLORS = {
  online:   '#00FF88',
  degraded: '#FF8C00',
  offline:  '#FF3D71',
  idle:     '#4A5568',
};

export default function StatusDot({ status = 'idle', size = 8 }) {
  const color = COLORS[status] ?? COLORS.idle;
  const pulse = status === 'online' || status === 'degraded';
  return (
    <span
      className={`${styles.dot} ${pulse ? styles.pulse : ''}`}
      style={{ width: size, height: size, background: color, boxShadow: pulse ? `0 0 0 0 ${color}` : 'none' }}
      title={status}
    />
  );
}
