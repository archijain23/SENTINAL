import React from 'react';
import styles from './StubPage.module.css';

export default function AlertsPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <h2 className={styles.title}>Alert Center</h2>
      <p className={styles.desc}>Real-time alerts &amp; threat notifications — coming in Batch 2.</p>
      <span className={styles.badge}>BATCH 2</span>
    </div>
  );
}
