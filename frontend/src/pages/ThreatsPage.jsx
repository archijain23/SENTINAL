import { useState, useEffect, useCallback, useRef } from 'react';
import { attacksAPI, blocklistAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';
import SeverityBadge from '../components/ui/SeverityBadge';
import styles from './ThreatsPage.module.css';

/* ─── constants ──────────────────────────────────────────────────────────── */
const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];
const SEV_ORDER  = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_COLOR  = { critical: '#dc2626', high: '#ef4444', medium: '#f97316', low: '#22c55e' };
const TYPE_ICON  = {
  sqli: '💉', xss: '⚡', traversal: '📁', command_injection: '💻',
  brute_force: '🔨', ssrf: '🌐', xxe: '📜', lfi_rfi: '📂',
  hpp: '🔀', webshell: '🐚', unknown: '❓',
};

function timeStr(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function timeShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

/* ─── group attacks by IP ────────────────────────────────────────────────── */
function groupByIP(attacks) {
  const map = new Map();
  for (const a of attacks) {
    const ip = a.sourceIP ?? a.ip ?? '—';
    if (!map.has(ip)) map.set(ip, []);
    map.get(ip).push(a);
  }
  // sort groups: highest severity first, then most recent
  return Array.from(map.entries()).map(([ip, events]) => {
    const topSev = events.reduce((best, e) => {
      const o = SEV_ORDER[e.severity?.toLowerCase()] ?? 99;
      return o < (SEV_ORDER[best] ?? 99) ? e.severity?.toLowerCase() : best;
    }, 'low');
    const latest = events.reduce((max, e) =>
      new Date(e.timestamp ?? 0) > new Date(max.timestamp ?? 0) ? e : max
    , events[0]);
    const allBlocked  = events.every(e => e.blocked || e.status === 'blocked');
    const allResolved = events.every(e => e.status === 'resolved');
    const country = events.find(e => e.country)?.country ?? null;
    const geoIntel = events.find(e => e.geoIntel)?.geoIntel ?? null;
    return { ip, events, topSev, latest, allBlocked, allResolved, country, geoIntel };
  }).sort((a, b) => {
    const sa = SEV_ORDER[a.topSev] ?? 99;
    const sb = SEV_ORDER[b.topSev] ?? 99;
    if (sa !== sb) return sa - sb;
    return new Date(b.latest.timestamp ?? 0) - new Date(a.latest.timestamp ?? 0);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   IP GROUP CARD
═══════════════════════════════════════════════════════════════════════════ */
function IPGroupCard({ group, onBlock, onResolve, onOpenModal, blocking }) {
  const [expanded, setExpanded] = useState(false);
  const { ip, events, topSev, latest, allBlocked, allResolved, country, geoIntel } = group;
  const attackCount  = events.length;
  const activeCount  = events.filter(e => !e.blocked && e.status !== 'resolved' && e.status !== 'blocked').length;
  const types        = [...new Set(events.map(e => e.type ?? e.attackType ?? 'unknown'))];
  const isBlocking   = blocking === ip;

  const statusLabel = allBlocked ? 'BLOCKED' : allResolved ? 'RESOLVED' : activeCount > 0 ? 'ACTIVE' : 'MIXED';
  const statusCls   = allBlocked ? styles.statusBlocked : allResolved ? styles.statusResolved : styles.statusActive;

  return (
    <div className={`${styles.ipCard} ${allBlocked ? styles.ipCardBlocked : ''}`}
      style={{ borderLeftColor: SEV_COLOR[topSev] ?? '#334155' }}>

      {/* ── Card Header ── */}
      <div className={styles.ipCardHeader} onClick={() => setExpanded(x => !x)}>
        <div className={styles.ipCardLeft}>
          <div className={styles.ipRow}>
            <code className={styles.ipAddress}>{ip}</code>
            <span className={styles.attackCountBadge}>
              {attackCount} {attackCount === 1 ? 'attack' : 'attacks'}
            </span>
            {activeCount > 0 && !allBlocked && (
              <span className={styles.activeBadge}>{activeCount} active</span>
            )}
            <span className={statusCls} style={{ fontSize: '0.6rem', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace' }}>
              {statusLabel}
            </span>
          </div>
          <div className={styles.ipMeta}>
            {country && <span className={styles.metaChip}>🌍 {country}</span>}
            {geoIntel?.is_tor   && <span className={styles.metaChipDanger}>🧅 TOR</span>}
            {geoIntel?.is_proxy && <span className={styles.metaChipWarn}>🔀 Proxy</span>}
            {geoIntel?.isp      && <span className={styles.metaChip}>{geoIntel.isp}</span>}
            <span className={styles.metaChip}>🕐 Last: {timeShort(latest.timestamp)}</span>
          </div>
          <div className={styles.typeChips}>
            {types.slice(0, 6).map(t => (
              <span key={t} className={styles.typeChip}>
                {TYPE_ICON[t] ?? '🔸'} {t}
              </span>
            ))}
            {types.length > 6 && <span className={styles.typeChip}>+{types.length - 6} more</span>}
          </div>
        </div>

        <div className={styles.ipCardRight}>
          <SeverityBadge level={topSev} />
          <span className={styles.expandToggle}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className={styles.ipCardActions} onClick={e => e.stopPropagation()}>
        {!allBlocked && (
          <button
            className={styles.blockBtn}
            onClick={() => onBlock(ip)}
            disabled={isBlocking}
          >
            {isBlocking ? <><span className={styles.spinnerSm} /> Blocking…</> : '🚫 Block IP'}
          </button>
        )}
        {allBlocked && (
          <span className={styles.blockedLabel}>🔒 IP Blocked — all future requests rejected</span>
        )}
        {!allResolved && !allBlocked && (
          <button className={styles.resolveBtn} onClick={() => onResolve(ip)}>
            ✅ Resolve All
          </button>
        )}
        <button className={styles.detailBtn} onClick={() => onOpenModal(group)}>
          🔍 Full Intel
        </button>
      </div>

      {/* ── Expanded Attack List ── */}
      {expanded && (
        <div className={styles.attackList}>
          <div className={styles.attackListHeader}>
            <span>{attackCount} recorded attack{attackCount !== 1 ? 's' : ''} from this IP</span>
          </div>
          {events
            .slice()
            .sort((a, b) => new Date(b.timestamp ?? 0) - new Date(a.timestamp ?? 0))
            .map((ev, i) => {
              const eid = ev._id ?? ev.id ?? i;
              const evBlocked  = ev.blocked || ev.status === 'blocked';
              const evResolved = ev.status === 'resolved';
              return (
                <div key={eid} className={styles.attackRow}
                  style={{ borderLeftColor: SEV_COLOR[ev.severity?.toLowerCase()] ?? '#334155' }}>
                  <div className={styles.attackRowTop}>
                    <span className={styles.attackIcon}>{TYPE_ICON[ev.type ?? ev.attackType] ?? '🔸'}</span>
                    <span className={styles.attackType}>{ev.type ?? ev.attackType ?? 'unknown'}</span>
                    <SeverityBadge level={ev.severity ?? 'low'} />
                    {ev.confidence != null && (
                      <span className={styles.confBadge}>🎯 {(ev.confidence * 100).toFixed(0)}%</span>
                    )}
                    <span className={styles.attackTime}>{timeStr(ev.timestamp)}</span>
                    {evBlocked  && <span className={styles.statusBlocked} style={{ fontSize: '0.58rem' }}>BLOCKED</span>}
                    {evResolved && <span className={styles.statusResolved} style={{ fontSize: '0.58rem' }}>RESOLVED</span>}
                  </div>
                  {(ev.url || ev.method) && (
                    <div className={styles.attackUrl}>
                      {ev.method && <span className={styles.methodBadge}>{ev.method}</span>}
                      {ev.url && <code className={styles.urlCode}>{ev.url}</code>}
                    </div>
                  )}
                  {ev.payload && (
                    <code className={styles.payloadCode}>
                      {typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)}
                    </code>
                  )}
                  {ev.nexusAction && (
                    <div className={styles.nexusAction}>🤖 Nexus: {ev.nexusAction}</div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL MODAL
═══════════════════════════════════════════════════════════════════════════ */
function DetailModal({ group, onClose, onBlock, onResolve, blocking }) {
  const ref = useRef();
  const { ip, events, topSev, allBlocked, allResolved, country, geoIntel } = group;
  const isBlocking = blocking === ip;

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const types     = [...new Set(events.map(e => e.type ?? e.attackType ?? 'unknown'))];
  const critCount = events.filter(e => e.severity?.toLowerCase() === 'critical').length;
  const highCount = events.filter(e => e.severity?.toLowerCase() === 'high').length;

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === ref.current && onClose()} ref={ref}>
      <div className={styles.modal}>
        {/* Modal Header */}
        <div className={styles.modalHeader} style={{ borderBottomColor: SEV_COLOR[topSev] + '44' }}>
          <div>
            <div className={styles.modalIpRow}>
              <code className={styles.modalIp}>{ip}</code>
              <SeverityBadge level={topSev} />
              {allBlocked && <span className={styles.blockedLabel}>🔒 BLOCKED</span>}
            </div>
            <div className={styles.modalSubtitle}>
              {events.length} recorded attacks · {types.length} attack type{types.length !== 1 ? 's' : ''}
              {country && ` · ${country}`}
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>

          {/* Stats row */}
          <div className={styles.modalStats}>
            {[
              { label: 'Total Attacks',  value: events.length,  color: '#e2e8f0' },
              { label: 'Critical',       value: critCount,       color: SEV_COLOR.critical },
              { label: 'High',           value: highCount,       color: SEV_COLOR.high },
              { label: 'Attack Types',   value: types.length,   color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} className={styles.statBox}>
                <span className={styles.statValue} style={{ color: s.color }}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Geo block */}
          {(country || geoIntel) && (
            <div className={styles.geoBlock}>
              <div className={styles.geoTitle}>📍 Geo Intelligence</div>
              <div className={styles.geoGrid}>
                {[
                  ['Country',   country ?? geoIntel?.country ?? '—'],
                  ['Country Code', geoIntel?.country_code ?? '—'],
                  ['City',      geoIntel?.city ?? '—'],
                  ['ISP',       geoIntel?.isp  ?? '—'],
                  ['Org',       geoIntel?.org  ?? '—'],
                  ['Abuse Score', geoIntel?.abuse_confidence_score != null ? `${geoIntel.abuse_confidence_score}%` : '—'],
                  ['TOR Exit',  geoIntel?.is_tor   ? '⚠️ Yes' : 'No'],
                  ['Proxy',     geoIntel?.is_proxy ? '⚠️ Yes' : 'No'],
                  ['Hosting',   geoIntel?.is_hosting ? 'Yes' : 'No'],
                ].map(([k, v]) => (
                  <div key={k} className={styles.geoItem}>
                    <span className={styles.geoKey}>{k}</span>
                    <span className={styles.geoVal}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attack type breakdown */}
          <div className={styles.typeBreakdown}>
            <div className={styles.geoTitle}>⚔️ Attack Types</div>
            {types.map(t => {
              const cnt = events.filter(e => (e.type ?? e.attackType) === t).length;
              const pct = Math.round((cnt / events.length) * 100);
              return (
                <div key={t} className={styles.typeBreakdownRow}>
                  <span className={styles.typeBreakdownLabel}>{TYPE_ICON[t] ?? '🔸'} {t}</span>
                  <div className={styles.typeBreakdownBar}>
                    <div className={styles.typeBreakdownFill}
                      style={{ width: `${pct}%`, background: SEV_COLOR[events.find(e => (e.type ?? e.attackType) === t)?.severity?.toLowerCase()] ?? '#3b82f6' }}
                    />
                  </div>
                  <span className={styles.typeBreakdownCount}>{cnt}×</span>
                </div>
              );
            })}
          </div>

          {/* Full attack log */}
          <div className={styles.modalAttackLog}>
            <div className={styles.geoTitle}>📋 Full Attack Log</div>
            {events
              .slice()
              .sort((a, b) => new Date(b.timestamp ?? 0) - new Date(a.timestamp ?? 0))
              .map((ev, i) => {
                const eid = ev._id ?? ev.id ?? i;
                const evBlocked  = ev.blocked || ev.status === 'blocked';
                const evResolved = ev.status === 'resolved';
                return (
                  <div key={eid} className={styles.modalAttackEntry}
                    style={{ borderLeftColor: SEV_COLOR[ev.severity?.toLowerCase()] ?? '#334155' }}>
                    <div className={styles.attackRowTop}>
                      <span className={styles.attackIcon}>{TYPE_ICON[ev.type ?? ev.attackType] ?? '🔸'}</span>
                      <span className={styles.attackType}>{ev.type ?? ev.attackType ?? 'unknown'}</span>
                      <SeverityBadge level={ev.severity ?? 'low'} />
                      {ev.confidence != null && (
                        <span className={styles.confBadge}>🎯 {(ev.confidence * 100).toFixed(0)}%</span>
                      )}
                      {evBlocked  && <span className={styles.statusBlocked} style={{ fontSize: '0.58rem' }}>BLOCKED</span>}
                      {evResolved && <span className={styles.statusResolved} style={{ fontSize: '0.58rem' }}>RESOLVED</span>}
                      <span className={styles.attackTime} style={{ marginLeft: 'auto' }}>{timeStr(ev.timestamp)}</span>
                    </div>
                    {(ev.url || ev.method) && (
                      <div className={styles.attackUrl}>
                        {ev.method && <span className={styles.methodBadge}>{ev.method}</span>}
                        {ev.url && <code className={styles.urlCode}>{ev.url}</code>}
                      </div>
                    )}
                    {ev.payload && (
                      <code className={styles.payloadCode}>
                        {typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)}
                      </code>
                    )}
                    {ev.nexusAction && (
                      <div className={styles.nexusAction}>🤖 Nexus: {ev.nexusAction}</div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          {!allBlocked && (
            <button className={styles.blockBtn} onClick={() => onBlock(ip)} disabled={isBlocking}>
              {isBlocking ? <><span className={styles.spinnerSm}/> Blocking…</> : '🚫 Block IP — reject all future requests'}
            </button>
          )}
          {allBlocked && (
            <span className={styles.blockedLabel}>🔒 IP is blocked — all future requests from this IP are rejected</span>
          )}
          {!allResolved && !allBlocked && (
            <button className={styles.resolveBtn} onClick={() => onResolve(ip)}>✅ Resolve All Events</button>
          )}
          <button className={styles.detailBtn} style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   THREATS PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function ThreatsPage() {
  const [attacks,    setAttacks]   = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState(null);
  const [page,       setPage]      = useState(1);
  const [total,      setTotal]     = useState(0);
  const [sevFilter,  setSevFilter] = useState('all');
  const [search,     setSearch]    = useState('');
  const [blocking,   setBlocking]  = useState(null);
  const [modalGroup, setModalGroup]= useState(null);
  const LIMIT = 20;

  /* ── load ── */
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

  /* ── live socket ── */
  useEffect(() => {
    const s = getSocket();
    const h = (a) => {
      setAttacks(prev => [a, ...prev].slice(0, 500));
      setTotal(t => t + 1);
    };
    s.on(SOCKET_EVENTS.NEW_ATTACK, h);
    return () => s.off(SOCKET_EVENTS.NEW_ATTACK, h);
  }, []);

  /* ── block IP — marks ALL events from that IP as blocked ── */
  const blockIP = async (ip) => {
    setBlocking(ip);
    try {
      await blocklistAPI.block({ ip, reason: 'Manual block from Threats page', source: 'analyst' });
      setAttacks(prev => prev.map(a =>
        (a.sourceIP === ip || a.ip === ip)
          ? { ...a, blocked: true, status: 'blocked' }
          : a
      ));
      // Close modal if open and its IP was just blocked
      setModalGroup(g => g && g.ip === ip
        ? { ...g, allBlocked: true, events: g.events.map(e => ({ ...e, blocked: true, status: 'blocked' })) }
        : g
      );
    } catch (err) { alert('Block failed: ' + err.message); }
    setBlocking(null);
  };

  /* ── resolve all events for an IP ── */
  const resolveIP = (ip) => {
    setAttacks(prev => prev.map(a =>
      (a.sourceIP === ip || a.ip === ip)
        ? { ...a, status: 'resolved' }
        : a
    ));
    setModalGroup(g => g && g.ip === ip
      ? { ...g, allResolved: true, events: g.events.map(e => ({ ...e, status: 'resolved' })) }
      : g
    );
  };

  /* ── filter & group ── */
  const filtered = attacks.filter(a => {
    const sev = a.severity?.toLowerCase() ?? '';
    const ok  = sevFilter === 'all' || sev === sevFilter;
    const s   = search.toLowerCase();
    const ms  = !search ||
      (a.sourceIP ?? a.ip ?? '').includes(s) ||
      (a.type ?? a.attackType ?? '').toLowerCase().includes(s) ||
      (a.country ?? '').toLowerCase().includes(s);
    return ok && ms;
  });

  const groups = groupByIP(filtered);
  const pageGroups = groups.slice(0, LIMIT * page);

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Threat Events</h1>
          {total > 0 && (
            <span className={styles.totalBadge}>
              {total.toLocaleString()} events · {groups.length} IPs
            </span>
          )}
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {/* ── Filters ── */}
      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Search IP, attack type, country…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.sevTabs}>
          {SEVERITIES.map(s => (
            <button key={s}
              className={`${styles.sevTab} ${sevFilter === s ? styles.sevTabActive : ''}`}
              onClick={() => setSevFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className={styles.errorBanner}>⚠ {error}</div>}

      {/* ── IP Group Cards ── */}
      <div className={styles.cardList}>
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))
        ) : pageGroups.length === 0 ? (
          <div className={styles.empty}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            <p>No threats match your filter</p>
          </div>
        ) : pageGroups.map(g => (
          <IPGroupCard
            key={g.ip}
            group={g}
            onBlock={blockIP}
            onResolve={resolveIP}
            onOpenModal={setModalGroup}
            blocking={blocking}
          />
        ))}
      </div>

      {/* ── Pagination ── */}
      {groups.length > LIMIT && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span className={styles.pageInfo}>Page {page} · {pageGroups.length} of {groups.length} IPs shown</span>
          <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= groups.length}>Next →</button>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {modalGroup && (
        <DetailModal
          group={modalGroup}
          onClose={() => setModalGroup(null)}
          onBlock={blockIP}
          onResolve={resolveIP}
          blocking={blocking}
        />
      )}
    </div>
  );
}
