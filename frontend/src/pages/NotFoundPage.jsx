import React from 'react';
import { Link } from 'react-router-dom';
import styles from './StubPage.module.css';

export default function NotFoundPage() {
  return (
    <div className={styles.stub}>
      <div className={styles.notFoundCode}>404</div>
      <h2 className={styles.title}>Page Not Found</h2>
      <p className={styles.desc}>The route you requested doesn't exist in this system.</p>
      <Link to="/app/dashboard" className={styles.backBtn}>← Return to Dashboard</Link>
    </div>
  );
}
