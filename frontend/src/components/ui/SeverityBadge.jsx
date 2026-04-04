import React from 'react';
import styles from './SeverityBadge.module.css';

const LEVELS = {
  critical: { label: 'Critical', cls: 'critical' },
  high:     { label: 'High',     cls: 'high' },
  medium:   { label: 'Medium',   cls: 'medium' },
  low:      { label: 'Low',      cls: 'low' },
  info:     { label: 'Info',     cls: 'info' },
};

export default function SeverityBadge({ level = 'info', size = 'sm' }) {
  const cfg = LEVELS[level?.toLowerCase()] ?? LEVELS.info;
  return (
    <span className={`${styles.badge} ${styles[cfg.cls]} ${styles[size]}`}>
      <span className={styles.dot} />
      {cfg.label}
    </span>
  );
}
