import React from 'react';
import styles from './StubPage.module.css';

export default function CorrelationPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </div>
      <h2 className={styles.title}>Correlation Engine</h2>
      <p className={styles.desc}>Risk score &amp; event correlation analysis — coming in Batch 4.</p>
      <span className={styles.badge}>BATCH 4</span>
    </div>
  );
}
