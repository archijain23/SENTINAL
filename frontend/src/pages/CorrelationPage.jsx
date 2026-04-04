/**
 * CorrelationPage (v3)
 *
 * Fixes:
 *  1. Shape mismatch — backend returns `campaigns[]`, frontend was reading `clusters[]`.
 *     Now reads: res.campaigns ?? res.clusters ?? res.groups ?? []
 *  2. sharedInfrastructure + attackChains sections rendered when present
 *  3. History cards show `campaignCount` (was reading nonexistent `clusterCount`)
 *  4. Socket cleanup: only socket.off() — no disconnectSocket() which tore down the
 *     shared global socket for all other pages
 *  5. Quota / API-key error handled with a dedicated banner
 *  6. Risk score badge shown in header
 *  7. Richer campaign cards: sourceIps, attackTypes, timeRange, assessment
 */
import { useState, useEffect, useCallback } from 'react';
import { correlationAPI } from '../services/api';
import { connectSocket, SOCKET_EVENTS } from '../services/socket';
import SeverityBadge from '../components/ui/SeverityBadge';
import styles from './CorrelationPage.module.css';

// ── helpers ──────────────────────────────────────────────────────────────────
function extractCampaigns(res) {
  // Backend shape: { campaigns, sharedInfrastructure, attackChains, riskScore, summary }
  // Tolerate old `clusters` / `groups` keys too.
  return Array.isArray(res?.campaigns)          ? res.campaigns
       : Array.isArray(res?.clusters)           ? res.clusters
       : Array.isArray(res?.groups)             ? res.groups
       : Array.isArray(res?.data?.campaigns)    ? res.data.campaigns
       : Array.isArray(res?.data)               ? res.data
       : [];
}

function extractMeta(res) {
  return {
    sharedInfrastructure: res?.sharedInfrastructure ?? [],
    attackChains:         res?.attackChains         ?? [],
    riskScore:            res?.riskScore             ?? null,
    summary:              res?.summary               ?? '',
    generated:            res?.generated             ?? false,
    errorCode:            res?.errorCode             ?? null,
  };
}

function RiskBadge({ score }) {
  if (score == null) return null;
  const color = score >= 75 ? '#ff3d71'
              : score >= 50 ? '#fb923c'
              : score >= 25 ? '#f59e0b'
              : '#00FF88';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 4,
      background: `${color}14`, border: `1px solid ${color}35`,
      fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color,
      letterSpacing: '0.05em',
    }}>
      Risk Score: {score}/100
    </span>
  );
}

export default function CorrelationPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [meta,      setMeta]      = useState({ sharedInfrastructure: [], attackChains: [], riskScore: null, summary: '', generated: false, errorCode: null });
  const [history,   setHistory]   = useState([]);
  const [tab,       setTab]       = useState('live');
  const [running,   setRunning]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(null);

  // ── load history ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const h = await correlationAPI.getHistory();
      // history endpoint returns array of CorrelationSnapshot docs
      setHistory(Array.isArray(h) ? h : h?.results ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── socket: live correlation results ─────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();

    const onCorrelationScore = (payload) => {
      const groups = extractCampaigns(payload);
      if (Array.isArray(groups) && groups.length > 0) {
        setCampaigns(groups);
        setMeta(extractMeta(payload));
        setTab('live');
        loadHistory();
      }
    };

    socket.on(SOCKET_EVENTS.CORRELATION_SCORE, onCorrelationScore);

    // FIX-4: only remove our listener — don't tear down the shared socket
    return () => {
      socket.off(SOCKET_EVENTS.CORRELATION_SCORE, onCorrelationScore);
    };
  }, [loadHistory]);

  // ── run ──────────────────────────────────────────────────────────────────
  const runCorrelation = async () => {
    setRunning(true);
    setError(null);
    try {
      // correlationAPI.run() → POST /api/gemini/correlate
      // unwrap() in api.js strips the outer { success, data } wrapper,
      // so `res` here IS the data object: { campaigns, sharedInfrastructure, ... }
      const res = await correlationAPI.run();
      setCampaigns(extractCampaigns(res));
      setMeta(extractMeta(res));
      setTab('live');
      await loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  // ── quota / key error banner ──────────────────────────────────────────────
  const isQuotaError = meta.errorCode === 'QUOTA_EXHAUSTED' || meta.errorCode === 'NO_API_KEY';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Attack Correlation</h1>
          <p className={styles.subtitle}>Gemini AI clusters related attacks into campaign groups</p>
          {meta.riskScore != null && <div style={{ marginTop: 8 }}><RiskBadge score={meta.riskScore} /></div>}
        </div>
        <button className={styles.runBtn} onClick={runCorrelation} disabled={running}>
          {running ? (
            <><span className={styles.spinner} /> Analyzing…</>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Correlation
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'live' ? styles.tabActive : ''}`}
          onClick={() => setTab('live')}
        >
          Latest Result {campaigns.length > 0 && `(${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''})`}
        </button>
        <button
          className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
          onClick={() => setTab('history')}
        >
          History {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      {/* Error / quota banners */}
      {error && <div className={styles.errorBanner}>⚠ {error}</div>}
      {isQuotaError && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)',
          color: '#fb923c', marginBottom: 4,
        }}>
          {meta.errorCode === 'NO_API_KEY'
            ? '⚠ Gemini API key not configured. Add GEMINI_API_KEY to your .env — showing static fallback results.'
            : '⚠ Gemini free-tier quota exhausted. Quota resets daily at midnight Pacific time — showing static fallback results.'}
        </div>
      )}
      {!isQuotaError && campaigns.length > 0 && meta.summary && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.12)',
          color: '#B8C4E0',
        }}>
          {meta.generated ? '🤖 AI Analysis: ' : '📊 Static Analysis: '}{meta.summary}
        </div>
      )}

      {/* ── Live Result Tab ── */}
      {tab === 'live' && (
        <div className={styles.clusterList}>
          {campaigns.length === 0 ? (
            <div className={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
              <p>Run a correlation to see attack campaigns</p>
            </div>
          ) : (
            <>
              {campaigns.map((c, i) => {
                const id     = c.id ?? c.clusterId ?? c.name ?? `campaign-${i}`;
                const isOpen = expanded === id;
                // Backend field names from geminiService.correlate():
                // { name, sourceIps, attackTypes, severity, eventCount, firstSeen, lastSeen, assessment }
                const name       = c.name ?? c.campaign ?? c.label ?? `Campaign ${i + 1}`;
                const count      = c.eventCount ?? c.attackCount ?? c.count ?? c.attacks?.length ?? '?';
                const severity   = c.severity ?? 'medium';
                const sourceIps  = c.sourceIps ?? c.sourceIPs ?? [];
                const atkTypes   = c.attackTypes ?? c.tactics ?? [];
                const assessment = c.assessment ?? c.summary ?? c.recommendation ?? null;
                const firstSeen  = c.firstSeen  ?? c.timeRange?.start ?? null;
                const lastSeen   = c.lastSeen   ?? c.timeRange?.end   ?? null;

                return (
                  <div key={id} className={styles.cluster}>
                    <button className={styles.clusterHeader} onClick={() => toggle(id)}>
                      <div className={styles.clusterLeft}>
                        <span className={styles.clusterIndex}>#{i + 1}</span>
                        <SeverityBadge level={severity} />
                        <span className={styles.clusterName}>{name}</span>
                        <span className={styles.clusterCount}>{count} events</span>
                      </div>
                      <span className={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div className={styles.clusterBody}>
                        {/* Assessment / summary */}
                        {assessment && (
                          <p className={styles.clusterSummary}>{assessment}</p>
                        )}

                        {/* Attack types */}
                        {atkTypes.length > 0 && (
                          <div className={styles.chips}>
                            {atkTypes.map(t => (
                              <span key={t} className={styles.tacticChip}>{t}</span>
                            ))}
                          </div>
                        )}

                        {/* Source IPs */}
                        {sourceIps.length > 0 && (
                          <div className={styles.ipList}>
                            <span className={styles.ipLabel}>Source IPs:</span>
                            {sourceIps.slice(0, 10).map(ip => (
                              <span key={ip} className={styles.ipChip}>{ip}</span>
                            ))}
                            {sourceIps.length > 10 && (
                              <span className={styles.ipMore}>+{sourceIps.length - 10} more</span>
                            )}
                          </div>
                        )}

                        {/* Time range */}
                        {(firstSeen || lastSeen) && (
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7894', marginTop: 8 }}>
                            {firstSeen && <span>First seen: {new Date(firstSeen).toLocaleString()}</span>}
                            {firstSeen && lastSeen && <span style={{ margin: '0 8px' }}>→</span>}
                            {lastSeen  && <span>Last seen: {new Date(lastSeen).toLocaleString()}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Shared Infrastructure */}
              {meta.sharedInfrastructure?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7894', marginBottom: 8 }}>
                    Shared Infrastructure
                  </div>
                  {meta.sharedInfrastructure.map((s, i) => (
                    <div key={i} style={{
                      padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                      background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)',
                      fontFamily: 'monospace', fontSize: 12, color: '#B8C4E0',
                    }}>
                      <div style={{ color: '#fb923c', marginBottom: 4 }}>
                        {(s.ips ?? []).join(' · ')}
                      </div>
                      <div>{s.evidence}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attack Chains */}
              {meta.attackChains?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7894', marginBottom: 8 }}>
                    Attack Chains
                  </div>
                  {meta.attackChains.map((ch, i) => (
                    <div key={i} style={{
                      padding: '10px 14px', borderRadius: 8, marginBottom: 8,
                      background: 'rgba(122,57,187,0.06)', border: '1px solid rgba(122,57,187,0.18)',
                      fontFamily: 'monospace', fontSize: 12, color: '#B8C4E0',
                    }}>
                      <div style={{ color: '#a86fdf', marginBottom: 4 }}>
                        {(ch.sequence ?? []).join(' → ')}
                      </div>
                      <div>{ch.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── History Tab ── */}
      {tab === 'history' && (
        <div className={styles.historyList}>
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)
          ) : history.length === 0 ? (
            <div className={styles.empty}><p>No correlation history yet. Run your first analysis above.</p></div>
          ) : history.map((h, i) => (
            <div key={h._id ?? h.id ?? i} className={styles.histCard}>
              <div className={styles.histTop}>
                <span className={styles.histTime}>
                  {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                </span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {h.riskScore != null && <RiskBadge score={h.riskScore} />}
                  <span className={styles.histClusters}>
                    {/* FIX-3: backend stores campaignCount, not clusterCount */}
                    {h.campaignCount ?? h.clusterCount ?? h.clusters?.length ?? '?'} campaigns
                  </span>
                </div>
              </div>
              {h.summary && <p className={styles.histSummary}>{h.summary}</p>}
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#3D4663', marginTop: 6 }}>
                {h.attackCount != null && `${h.attackCount} attacks analysed`}
                {h.generated === false && ' · static fallback'}
                {h.generated === true  && ' · AI generated'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
