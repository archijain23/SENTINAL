import React from 'react';
import styles from './StubPage.module.css';

export default function ExplorePage() {
  return (
    <div className={styles.stub}>
      <div className={styles.icon}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <h2 className={styles.title}>IP Explorer</h2>
      <p className={styles.desc}>IP intelligence &amp; geo enrichment — coming in Batch 3.</p>
      <span className={styles.badge}>BATCH 3</span>
    </div>
  );
}
