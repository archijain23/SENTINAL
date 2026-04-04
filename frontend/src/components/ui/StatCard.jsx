import React from 'react';
import styles from './StatCard.module.css';

export default function StatCard({ label, value, sub, trend, icon, variant = 'default', loading = false }) {
  return (
    <div className={`${styles.card} ${styles[variant]}`}>
      {loading ? (
        <div className={styles.skeleton}>
          <div className={styles.skelLine} style={{ width: '60%' }} />
          <div className={styles.skelLine} style={{ width: '40%', height: '2rem' }} />
        </div>
      ) : (
        <>
          <div className={styles.top}>
            <span className={styles.label}>{label}</span>
            {icon && <span className={styles.icon}>{icon}</span>}
          </div>
          <div className={styles.value} aria-live="polite">{value ?? '—'}</div>
          <div className={styles.bottom}>
            {trend !== undefined && (
              <span className={`${styles.trend} ${trend >= 0 ? styles.up : styles.down}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}
            {sub && <span className={styles.sub}>{sub}</span>}
          </div>
        </>
      )}
    </div>
  );
}
