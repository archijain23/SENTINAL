import React from 'react';
import styles from './StubPage.module.css';

export default function SimulatePage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 3h6M9 3v8l-4 9h14l-4-9V3"/>
        </svg>
      </div>
      <h2 className={styles.title}>Attack Simulator</h2>
      <p className={styles.desc}>AI-powered attack simulation lab — coming in Batch 4.</p>
      <span className={styles.badge}>BATCH 4</span>
    </div>
  );
}
