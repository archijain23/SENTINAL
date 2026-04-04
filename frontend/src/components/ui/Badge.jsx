import React from 'react';
import styles from './Badge.module.css';

export default function Badge({ children, variant = 'default', size = 'sm', dot = false }) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${styles[size]}`}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
