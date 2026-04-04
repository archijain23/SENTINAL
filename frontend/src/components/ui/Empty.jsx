import React from 'react';
import styles from './Empty.module.css';

export default function Empty({ icon = '◎', title = 'Nothing here', sub, action }) {
  return (
    <div className={styles.empty}>
      <div className={styles.iconWrap}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      {sub && <p className={styles.sub}>{sub}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
