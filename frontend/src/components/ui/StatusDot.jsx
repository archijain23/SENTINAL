import React from 'react';
import styles from './StatusDot.module.css';

/**
 * Small animated status indicator.
 * status: 'online' | 'degraded' | 'offline' | 'idle'
 */
export default function StatusDot({ status = 'idle', label, showLabel = false }) {
  return (
    <span className={`${styles.wrap} ${styles[status]}`} title={label || status}>
      <span className={styles.dot} />
      {showLabel && <span className={styles.label}>{label || status}</span>}
    </span>
  );
}
