import React from 'react';
import styles from './Table.module.css';

export default function Table({ columns, rows, onRowClick, loading, emptyMsg = 'No data' }) {
  if (loading) return <TableSkeleton cols={columns.length} />;
  if (!rows?.length) return <div className={styles.empty}>{emptyMsg}</div>;

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} className={styles.th} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id || i}
              className={`${styles.tr} ${onRowClick ? styles.clickable : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(col => (
                <td key={col.key} className={styles.td}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton({ cols }) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead><tr>{Array(cols).fill(0).map((_, i) => <th key={i} className={styles.th}><div className={styles.skel} /></th>)}</tr></thead>
        <tbody>{Array(6).fill(0).map((_, i) => (
          <tr key={i}>{Array(cols).fill(0).map((_, j) => (
            <td key={j} className={styles.td}><div className={styles.skel} /></td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
