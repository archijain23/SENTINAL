import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ width, height, circle, className = '' }) {
  return (
    <span
      className={`${styles.skel} ${circle ? styles.circle : ''} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonBlock({ rows = 3, gap = 'sm' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: gap === 'sm' ? '8px' : '12px' }}>
      {Array(rows).fill(0).map((_, i) => (
        <Skeleton key={i} width={i === rows - 1 ? '60%' : '100%'} height="14px" />
      ))}
    </div>
  );
}
