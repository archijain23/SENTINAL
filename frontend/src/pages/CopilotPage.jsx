import React from 'react';
import styles from './StubPage.module.css';

export default function CopilotPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3l1.9 5.8L19.7 9l-4.6 4.5 1.1 6.3L12 17l-4.2 2.8 1.1-6.3L4.3 9l5.8-.2z"/>
        </svg>
      </div>
      <h2 className={styles.title}>AI Copilot</h2>
      <p className={styles.desc}>Streaming Gemini AI security assistant — coming in Batch 4.</p>
      <span className={styles.badge}>BATCH 4</span>
    </div>
  );
}
