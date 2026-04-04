import React from 'react';
import styles from './PageHeader.module.css';

export default function PageHeader({ title, sub, actions, badge }) {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {badge && <span className={styles.badge}>{badge}</span>}
        </div>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
