import React from 'react';
import styles from './Button.module.css';

export default function Button({
  children, variant = 'primary', size = 'md',
  loading = false, disabled = false, onClick,
  type = 'button', icon, className = '', ...rest
}) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${loading ? styles.loading : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden /> : icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </button>
  );
}
