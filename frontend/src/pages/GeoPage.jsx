import React from 'react';
import styles from './StubPage.module.css';

export default function GeoPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9"/>
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>
      <h2 className={styles.title}>Geo Threat Map</h2>
      <p className={styles.desc}>World map with live attack origins &amp; IP intel — coming in Batch 5.</p>
      <span className={styles.badge}>BATCH 5</span>
    </div>
  );
}
