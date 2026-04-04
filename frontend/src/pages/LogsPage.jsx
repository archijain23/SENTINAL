import React from 'react';
import styles from './StubPage.module.css';

export default function LogsPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
      </div>
      <h2 className={styles.title}>System Logs</h2>
      <p className={styles.desc}>Live log stream with level filtering &amp; search — coming in Batch 2.</p>
      <span className={styles.badge}>BATCH 2</span>
    </div>
  );
}
