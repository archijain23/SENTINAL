import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { attacksAPI, blocklistAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import SeverityBadge from '../components/ui/SeverityBadge';
import styles from './ThreatsPage.module.css';

const SEVERITIES  = ['all', 'critical', 'high', 'medium', 'low'];
const SORT_FIELDS = ['timestamp', 'severity', 'type', 'sourceIP'];
const SEV_ORDER   = { critical: 0, high: 1, medium: 2, low: 3 };

function timeStr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

export default function ThreatsPage() {
  const navigate = useNavigate();
  const [attacks,  setAttacks]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [sevFilter, setSevFilter] = useState('all');
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('timestamp');
  const [sortDir,  setSortDir]  = useState('desc');
  const [blocking, setBlocking] = useState(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await attacksAPI.getRecent(LIMIT * page);
      const data = Array.isArray(res) ? res : res?.attacks ?? res?.data ?? [];
      setAttacks(data);
      setTotal(res?.total ?? res?.count ?? data.length);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // Live prepend
  useEffect(() => {
    const s = getSocket();
    const h = (a) => {
      setAttacks(prev => [a, ...prev].slice(0, 500));
      setTotal(t => t + 1);
    };
    s.on(SOCKET_EVENTS.NEW_ATTACK, h);
    return () => s.off(SOCKET_EVENTS.NEW_ATTACK, h);
  }, []);

  const blockIP = async (ip, e) => {
    e.stopPropagation();
    setBlocking(ip);
    try {
      await blocklistAPI.block({ ip, reason: 'Manual block from Threats page', source: 'analyst' });
      setAttacks(prev => prev.map(a => a.sourceIP === ip ? { ...a, blocked: true } : a));
    } catch (err) { alert('Block failed: ' + err.message); }
    setBlocking(null);
  };

  const resolveLocal = (id, e) => {
    e.stopPropagation();
    setAttacks(prev => prev.map(a =>
      (a._id === id || a.id === id) ? { ...a, status: 'resolved' } : a
    ));
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const filtered = attacks
    .filter(a => {
      const sev = a.severity?.toLowerCase() ?? '';
      const ok  = sevFilter === 'all' || sev === sevFilter;
      const s   = search.toLowerCase();
      const ms  = !search ||
        a.sourceIP?.includes(s) ||
        a.type?.toLowerCase().includes(s) ||
        a.attackType?.toLowerCase().includes(s) ||
        a.country?.toLowerCase().includes(s);
      return ok && ms;
    })
    .sort((a, b) => {
      let va, vb;
      if (sortBy === 'severity') {
        va = SEV_ORDER[a.severity?.toLowerCase()] ?? 99;
        vb = SEV_ORDER[b.severity?.toLowerCase()] ?? 99;
      } else if (sortBy === 'timestamp') {
        va = new Date(a.timestamp ?? 0).getTime();
        vb = new Date(b.timestamp ?? 0).getTime();
      } else {
        va = (a[sortBy] ?? '').toString().toLowerCase();
        vb = (b[sortBy] ?? '').toString().toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

  const SortIcon = ({ field }) => (
    <span className={styles.sortIcon} style={{ opacity: sortBy === field ? 1 : 0.25 }}>
      {sortBy === field ? (sortDir === 'asc' ? '▲' : '▼') : '▼'}
    </span>
  );

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Threat Events</h1>
          {total > 0 && <span className={styles.totalBadge}>{total.toLocaleString()} total</span>}
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input className={styles.search} placeholder="Search IP, type, country…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.sevTabs}>
          {SEVERITIES.map(s => (
            <button key={s} className={`${styles.sevTab} ${sevFilter === s ? styles.sevTabActive : ''}`} onClick={() => setSevFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {[['timestamp','Time'],['sourceIP','Source IP'],['type','Type'],['severity','Severity'],['country','Country'],['status','Status'],['','Actions']].map(([f, label]) => (
                <th key={label} onClick={f ? () => toggleSort(f) : undefined} className={f ? styles.thSortable : ''}>
                  {label} {f && <SortIcon field={f} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}><td colSpan={7}><div className={styles.skeletonRow} /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className={styles.empty}>
                  <p>No threats match your filter</p>
                </div>
              </td></tr>
            ) : filtered.slice(0, LIMIT * page).map(a => {
              const id = a._id ?? a.id;
              const isResolved = a.status === 'resolved';
              const isBlocked  = a.blocked || a.status === 'blocked';
              return (
                <tr key={id} className={styles.row} onClick={() => navigate(`/app/threats/${id}`)}>
                  <td className={styles.monoMuted}>{timeStr(a.timestamp)}</td>
                  <td className={styles.monoAccent}>{a.sourceIP ?? '—'}</td>
                  <td className={styles.typeCell}>{a.type ?? a.attackType ?? '—'}</td>
                  <td><SeverityBadge level={a.severity ?? 'low'} /></td>
                  <td className={styles.monoMuted}>{a.country ?? '—'}</td>
                  <td>
                    <span className={isBlocked ? styles.statusBlocked : isResolved ? styles.statusResolved : styles.statusActive}>
                      {isBlocked ? 'blocked' : isResolved ? 'resolved' : a.status ?? 'active'}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.rowActions}>
                      {!isBlocked && (
                        <button className={styles.blockBtn} onClick={e => blockIP(a.sourceIP, e)} disabled={blocking === a.sourceIP}>
                          {blocking === a.sourceIP ? '…' : 'Block'}
                        </button>
                      )}
                      {!isResolved && (
                        <button className={styles.resolveBtn} onClick={e => resolveLocal(id, e)}>Resolve</button>
                      )}
                      <button className={styles.detailBtn} onClick={() => navigate(`/app/threats/${id}`)}>
                        Details →
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} · {filtered.length} shown</span>
          <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}>Next →</button>
        </div>
      )}
    </div>
  );
}
