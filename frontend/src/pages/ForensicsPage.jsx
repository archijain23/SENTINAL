import React from 'react';
import styles from './StubPage.module.css';

export default function ForensicsPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7"/>
          <path d="m21 21-4.35-4.35"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>
      <h2 className={styles.title}>Threat Forensics</h2>
      <p className={styles.desc}>Deep-dive per-attack AI report — coming in Batch 2.</p>
      <span className={styles.badge}>BATCH 2</span>
    </div>
  );
}
