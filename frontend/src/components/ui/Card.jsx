import React from 'react';
import styles from './Card.module.css';

export default function Card({ children, className = '', glow = false, onClick, padding = 'md' }) {
  return (
    <div
      className={`${styles.card} ${glow ? styles.glow : ''} ${styles[`pad-${padding}`]} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, action, className = '' }) {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.headerTitle}>{children}</div>
      {action && <div className={styles.headerAction}>{action}</div>}
    </div>
  );
}

export function CardTitle({ children, sub }) {
  return (
    <div>
      <h2 className={styles.title}>{children}</h2>
      {sub && <p className={styles.sub}>{sub}</p>}
    </div>
  );
}
