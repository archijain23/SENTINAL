import React from 'react';
import styles from './FilterBar.module.css';

/**
 * Reusable filter/search toolbar.
 * Props: search, onSearch, filters (array of {key, label, options}), values, onChange, actions (array of ReactNodes)
 */
export default function FilterBar({ search, onSearch, filters = [], values = {}, onChange, actions }) {
  return (
    <div className={styles.bar}>
      {onSearch !== undefined && (
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search…"
            value={search}
            onChange={e => onSearch(e.target.value)}
            aria-label="Search"
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => onSearch('')} aria-label="Clear search">✕</button>
          )}
        </div>
      )}

      {filters.map(f => (
        <select
          key={f.key}
          className={styles.select}
          value={values[f.key] || ''}
          onChange={e => onChange?.(f.key, e.target.value)}
          aria-label={f.label}
        >
          <option value="">{f.label}: All</option>
          {f.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
