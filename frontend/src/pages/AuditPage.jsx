import React from 'react';
import styles from './StubPage.module.css';

export default function AuditPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1"/>
        </svg>
      </div>
      <h2 className={styles.title}>Audit Log</h2>
      <p className={styles.desc}>Complete activity timeline with filters — coming in Batch 3.</p>
      <span className={styles.badge}>BATCH 3</span>
    </div>
  );
}
