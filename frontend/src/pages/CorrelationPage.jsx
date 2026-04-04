import { useState, useEffect, useCallback } from 'react';
import { correlationAPI } from '../services/api';
import SeverityBadge from '../components/ui/SeverityBadge';
import styles from './CorrelationPage.module.css';

export default function CorrelationPage() {
  const [clusters,  setClusters]  = useState([]);
  const [history,   setHistory]   = useState([]);
  const [tab,       setTab]       = useState('live');
  const [running,   setRunning]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const h = await correlationAPI.getHistory();
      setHistory(Array.isArray(h) ? h : h?.results ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runCorrelation = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await correlationAPI.run();
      const groups = res?.clusters ?? res?.groups ?? res?.data ?? [];
      setClusters(Array.isArray(groups) ? groups : []);
      setTab('live');
      await loadHistory();
    } catch (e) { setError(e.message); }
    finally    { setRunning(false); }
  };

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attack Correlation</h1>
          <p className={styles.subtitle}>Gemini AI clusters related attacks into campaign groups</p>
        </div>
        <button className={styles.runBtn} onClick={runCorrelation} disabled={running}>
          {running ? (
            <><span className={styles.spinner} /> Analyzing…</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Correlation</>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'live' ? styles.tabActive : ''}`} onClick={() => setTab('live')}>
          Latest Result {clusters.length > 0 && `(${clusters.length} clusters)`}
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`} onClick={() => setTab('history')}>
          History {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* Live Result */}
      {tab === 'live' && (
        <div className={styles.clusterList}>
          {clusters.length === 0 ? (
            <div className={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              <p>Run a correlation to see attack clusters</p>
            </div>
          ) : clusters.map((c, i) => {
            const id = c.id ?? c.clusterId ?? `cluster-${i}`;
            const isOpen = expanded === id;
            return (
              <div key={id} className={styles.cluster}>
                <button className={styles.clusterHeader} onClick={() => toggle(id)}>
                  <div className={styles.clusterLeft}>
                    <span className={styles.clusterIndex}>#{i + 1}</span>
                    <SeverityBadge level={c.severity ?? 'medium'} />
                    <span className={styles.clusterName}>{c.name ?? c.campaign ?? c.label ?? `Cluster ${i + 1}`}</span>
                    <span className={styles.clusterCount}>{c.count ?? c.attacks?.length ?? '?'} attacks</span>
                  </div>
                  <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className={styles.clusterBody}>
                    {c.summary && <p className={styles.clusterSummary}>{c.summary}</p>}
                    {c.tactics && (
                      <div className={styles.chips}>
                        {c.tactics.map(t => <span key={t} className={styles.tacticChip}>{t}</span>)}
                      </div>
                    )}
                    {c.sourceIPs && (
                      <div className={styles.ipList}>
                        <span className={styles.ipLabel}>Source IPs:</span>
                        {c.sourceIPs.slice(0, 10).map(ip => <span key={ip} className={styles.ipChip}>{ip}</span>)}
                        {c.sourceIPs.length > 10 && <span className={styles.ipMore}>+{c.sourceIPs.length - 10} more</span>}
                      </div>
                    )}
                    {c.recommendation && (
                      <div className={styles.recommendation}>
                        <span className={styles.recLabel}>Recommendation:</span>
                        <p className={styles.recText}>{c.recommendation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className={styles.historyList}>
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)
          ) : history.length === 0 ? (
            <div className={styles.empty}><p>No correlation history yet</p></div>
          ) : history.map((h, i) => (
            <div key={h._id ?? h.id ?? i} className={styles.histCard}>
              <div className={styles.histTop}>
                <span className={styles.histTime}>{h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}</span>
                <span className={styles.histClusters}>{h.clusterCount ?? h.clusters?.length ?? '?'} clusters</span>
              </div>
              {h.summary && <p className={styles.histSummary}>{h.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
