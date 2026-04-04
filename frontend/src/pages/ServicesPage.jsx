import React from 'react';
import styles from './StubPage.module.css';

export default function ServicesPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
          <rect x="9" y="9" width="6" height="6"/>
        </svg>
      </div>
      <h2 className={styles.title}>Service Health</h2>
      <p className={styles.desc}>Microservice health &amp; uptime monitoring — coming in Batch 3.</p>
      <span className={styles.badge}>BATCH 3</span>
    </div>
  );
}
