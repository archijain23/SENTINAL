import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ipAPI, blocklistAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { SOCKET_EVENTS } from '../services/socket';

/* ─── Offline fallback data (used when backend is unreachable) ─── */
const MOCK_IPS = [
  { ip: '185.220.101.47', country: 'Russia',      country_code: 'RU', isp: 'Frantech Solutions',  type: 'Tor Exit Node', risk: 95, tags: ['tor','malicious','scanner'],  is_tor: true,  is_proxy: false, avg_abuse: 95, count: 38, seen: '2026-04-04T08:12:00Z' },
  { ip: '103.21.244.0',   country: 'China',        country_code: 'CN', isp: 'Cloudflare',         type: 'CDN / Proxy',   risk: 12, tags: ['cdn','proxy'],                is_tor: false, is_proxy: true,  avg_abuse: 10, count:  4, seen: '2026-04-03T14:55:00Z' },
  { ip: '45.33.32.156',   country: 'USA',          country_code: 'US', isp: 'Linode LLC',         type: 'VPS',           risk: 48, tags: ['cloud','vps'],                is_tor: false, is_proxy: false, avg_abuse: 40, count: 11, seen: '2026-04-04T07:01:00Z' },
  { ip: '91.121.87.0',    country: 'France',       country_code: 'FR', isp: 'OVH SAS',            type: 'Hosting',       risk: 63, tags: ['hosting','brute-force'],      is_tor: false, is_proxy: false, avg_abuse: 58, count: 22, seen: '2026-04-03T22:33:00Z' },
  { ip: '196.188.0.0',    country: 'Ethiopia',     country_code: 'ET', isp: 'Ethio Telecom',      type: 'ISP',           risk: 81, tags: ['c2','malicious'],             is_tor: false, is_proxy: false, avg_abuse: 80, count: 17, seen: '2026-04-04T05:49:00Z' },
  { ip: '89.248.167.0',   country: 'Netherlands',  country_code: 'NL', isp: 'Shadowserver',       type: 'Research',      risk:  5, tags: ['research','scanner'],         is_tor: false, is_proxy: false, avg_abuse:  3, count:  2, seen: '2026-04-02T11:20:00Z' },
  { ip: '144.126.0.0',    country: 'USA',          country_code: 'US', isp: 'DigitalOcean',       type: 'VPS',           risk: 72, tags: ['vps','spam','malicious'],     is_tor: false, is_proxy: false, avg_abuse: 70, count: 29, seen: '2026-04-04T03:14:00Z' },
  { ip: '5.188.206.0',    country: 'Russia',       country_code: 'RU', isp: 'SELECTEL',           type: 'Hosting',       risk: 88, tags: ['ransomware','c2'],            is_tor: false, is_proxy: false, avg_abuse: 90, count: 43, seen: '2026-04-04T09:05:00Z' },
];

/* ─── Helpers ─── */
const riskColor = (r) => r >= 80 ? 'var(--color-notification, #ef4444)' : r >= 60 ? 'var(--color-warning, #f97316)' : r >= 40 ? 'var(--color-gold, #eab308)' : 'var(--color-success, #22c55e)';
const riskLabel = (r) => r >= 80 ? 'CRITICAL' : r >= 60 ? 'HIGH'     : r >= 40 ? 'MEDIUM'   : 'LOW';

/**
 * Normalise a raw backend heatmap entry into the shape ExplorePage uses.
 * Backend returns: { country_code, country, lat, lng, count, critical, high,
 *                    tor_count, proxy_count, avg_abuse }
 * We synthesise a composite risk score from avg_abuse + critical ratio.
 */
function normaliseEntry(raw) {
  const count    = raw.count    || 1;
  const critical = raw.critical || 0;
  const abuse    = raw.avg_abuse || 0;
  const torBonus = raw.tor_count > 0 ? 10 : 0;
  const risk     = Math.min(100, Math.round(abuse * 0.6 + (critical / count) * 30 + torBonus));

  const tags = [];
  if (raw.tor_count   > 0) tags.push('tor');
  if (raw.proxy_count > 0) tags.push('proxy');
  if (abuse >= 70)         tags.push('high-abuse');
  if (critical > 0)        tags.push('critical-attacks');

  return {
    ip:           raw.ip           || raw.country_code || '—',
    country:      raw.country      || '—',
    country_code: raw.country_code || '??',
    isp:          raw.isp          || 'Unknown',
    type:         raw.type         || 'Country Aggregate',
    risk,
    tags:         tags.length ? tags : ['unknown'],
    is_tor:       (raw.tor_count   || 0) > 0,
    is_proxy:     (raw.proxy_count || 0) > 0,
    avg_abuse:    abuse,
    count,
    critical,
    high:         raw.high    || 0,
    seen:         raw.seen    || raw.last_seen || new Date().toISOString(),
    lat:          raw.lat,
    lng:          raw.lng,
    _live:        raw._live || false,
  };
}

/* ─── Skeleton row ─── */
function SkeletonRow() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '0.5rem',
      padding: '0.875rem 1.1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    }}>
      <div className="skel-pulse" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skel-pulse" style={{ height: '0.875rem', width: '35%', marginBottom: '0.4rem', borderRadius: '0.25rem' }} />
        <div className="skel-pulse" style={{ height: '0.75rem',  width: '55%', borderRadius: '0.25rem' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        {[60, 50, 70].map((w, i) => (
          <div key={i} className="skel-pulse" style={{ height: '1.25rem', width: w, borderRadius: '9999px' }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Stats chip ─── */
function StatChip({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${accent}33`,
      borderRadius: '0.5rem',
      padding: '0.625rem 1rem',
      display: 'flex', flexDirection: 'column', gap: '0.2rem',
      minWidth: 120,
    }}>
      <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {value ?? <span style={{ opacity: 0.3 }}>—</span>}
      </span>
    </div>
  );
}

/* ─── IP Row ─── */
function IpRow({ entry, isSelected, onSelect, onBlock }) {
  const [copied, setCopied] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked,  setBlocked]  = useState(false);

  const copyIp = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(entry.ip).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleBlock = async (e) => {
    e.stopPropagation();
    setBlocking(true);
    try {
      await blocklistAPI.block({ ip: entry.ip, reason: `Manual block from IP Explorer — risk score ${entry.risk}` });
      setBlocked(true);
      onBlock?.(entry.ip);
    } catch {
      /* silently surface via blocked=false */
    } finally {
      setBlocking(false);
    }
  };

  const rc = riskColor(entry.risk);

  return (
    <div
      onClick={() => onSelect(entry)}
      style={{
        background: isSelected ? `color-mix(in oklab, ${rc} 5%, var(--color-surface))` : 'var(--color-surface)',
        border: `1px solid ${isSelected ? rc + '55' : 'var(--color-border)'}`,
        borderRadius: '0.5rem',
        padding: '0.875rem 1.1rem',
        cursor: 'pointer',
        transition: 'border-color 140ms, background 140ms',
        animation: entry._live ? 'rowFlash 1.2s ease-out forwards' : 'none',
      }}
    >
      {/* ── Main row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>

          {/* Risk ring — 48px, readable */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: `2px solid ${rc}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8125rem', fontWeight: 700, color: rc,
              fontVariantNumeric: 'tabular-nums',
              background: `${rc}11`,
            }}>{entry.risk}</div>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: rc, letterSpacing: '0.04em', marginTop: '0.15rem' }}>
              {riskLabel(entry.risk)}
            </div>
          </div>

          {/* IP + meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9375rem',
                color: 'var(--color-primary)',
              }}>{entry.ip}</span>
              <button
                onClick={copyIp}
                title="Copy IP"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: copied ? 'var(--color-success)' : 'var(--color-text-faint)',
                  padding: '0 0.2rem', fontSize: '0.75rem', lineHeight: 1,
                  transition: 'color 150ms',
                }}
              >
                {copied ? '✓' : '⎘'}
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {entry.country_code !== '—' && <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{entry.country_code}</span>}
              {' '}{entry.country}
              {entry.isp !== 'Unknown' && <> · {entry.isp}</>}
              {entry.type !== 'Country Aggregate' && <> · {entry.type}</>}
            </div>
          </div>
        </div>

        {/* Tags + risk badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
          {entry.is_tor   && <Flag label="TOR"   color="var(--color-notification)" />}
          {entry.is_proxy && <Flag label="PROXY" color="var(--color-warning)" />}
          {entry.tags.filter(t => t !== 'tor' && t !== 'proxy').map(t => (
            <span key={t} style={{
              fontSize: '0.6375rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              textTransform: 'lowercase',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {isSelected && (
        <div style={{
          marginTop: '0.875rem', paddingTop: '0.875rem',
          borderTop: '1px solid var(--color-border)',
          animation: 'expandIn 160ms ease',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '0.75rem',
            marginBottom: '0.875rem',
          }}>
            {[
              { label: 'Country',       value: `${entry.country} (${entry.country_code})` },
              { label: 'ISP / Org',     value: entry.isp },
              { label: 'Node Type',     value: entry.type },
              { label: 'Risk Score',    value: `${entry.risk} / 100`, accent: rc },
              { label: 'Abuse Score',   value: `${entry.avg_abuse} / 100`, accent: entry.avg_abuse >= 50 ? 'var(--color-warning)' : undefined },
              { label: 'Total Attacks', value: entry.count },
              { label: 'Critical',      value: entry.critical ?? '—', accent: entry.critical > 0 ? 'var(--color-notification)' : undefined },
              { label: 'High',          value: entry.high ?? '—' },
              { label: 'TOR Exit',      value: entry.is_tor   ? 'YES' : 'No', accent: entry.is_tor   ? 'var(--color-notification)' : undefined },
              { label: 'Proxy',         value: entry.is_proxy ? 'YES' : 'No', accent: entry.is_proxy ? 'var(--color-warning)' : undefined },
              { label: 'Last Seen',     value: new Date(entry.seen).toLocaleString() },
              entry.lat != null && { label: 'Coordinates', value: `${Number(entry.lat).toFixed(2)}, ${Number(entry.lng).toFixed(2)}` },
            ].filter(Boolean).map(f => (
              <div key={f.label} style={{ fontSize: '0.8125rem' }}>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem', marginBottom: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
                <div style={{ fontWeight: 600, color: f.accent || 'var(--color-text)' }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!blocked ? (
              <button
                onClick={handleBlock}
                disabled={blocking}
                style={{
                  fontSize: '0.75rem', padding: '0.35rem 0.875rem',
                  borderRadius: '0.375rem', cursor: blocking ? 'wait' : 'pointer',
                  background: 'var(--color-notification)',
                  color: '#fff', border: 'none', fontWeight: 600,
                  opacity: blocking ? 0.6 : 1, transition: 'opacity 150ms',
                }}
              >
                {blocking ? 'Blocking…' : '⊘ Block IP'}
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600, padding: '0.35rem 0' }}>✓ IP Blocked</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); copyIp(e); }}
              style={{
                fontSize: '0.75rem', padding: '0.35rem 0.875rem',
                borderRadius: '0.375rem', cursor: 'pointer',
                background: 'var(--color-surface-offset, rgba(255,255,255,0.06))',
                color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', fontWeight: 500,
              }}
            >
              {copied ? '✓ Copied' : '⎘ Copy IP'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Flag({ label, color }) {
  return (
    <span style={{
      fontSize: '0.6rem', padding: '0.15rem 0.45rem', borderRadius: '9999px',
      background: `${color}22`, border: `1px solid ${color}66`,
      color, fontWeight: 700, letterSpacing: '0.06em',
    }}>{label}</span>
  );
}

/* ─── Main page ─── */
export default function ExplorePage() {
  const [entries,    setEntries]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [isOffline,  setIsOffline]  = useState(false);

  // Filters
  const [query,     setQuery]     = useState('');
  const [riskMin,   setRiskMin]   = useState(0);
  const [activeTag, setActiveTag] = useState(null);
  const [sortBy,    setSortBy]    = useState('risk');
  const [selected,  setSelected]  = useState(null);

  // Manual IP lookup
  const [lookupQuery,   setLookupQuery]   = useState('');
  const [lookupResult,  setLookupResult]  = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError,   setLookupError]   = useState(null);
  const lookupInputRef = useRef(null);

  /* ── Load heatmap + stats ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const [heatmapRes, statsRes] = await Promise.allSettled([
        ipAPI.getHeatmap(),
        ipAPI.getStats(),
      ]);

      if (heatmapRes.status === 'fulfilled') {
        const raw = heatmapRes.value?.heatmap || heatmapRes.value || [];
        setEntries(Array.isArray(raw) ? raw.map(normaliseEntry) : MOCK_IPS);
      } else {
        // Backend unreachable — fall back to mock data
        setEntries(MOCK_IPS);
        setIsOffline(true);
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      }
    } catch (err) {
      setError(err.message);
      setEntries(MOCK_IPS);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Socket: geo:event pushes new live entries ── */
  useSocket({
    [SOCKET_EVENTS.GEO_EVENT]: useCallback((payload) => {
      if (!payload) return;
      const entry = normaliseEntry({ ...payload, _live: true });
      setEntries(prev => {
        // deduplicate by ip/country_code
        const key = entry.ip || entry.country_code;
        const filtered = prev.filter(e => (e.ip || e.country_code) !== key);
        return [entry, ...filtered].slice(0, 200);
      });
      // clear _live flag after animation
      setTimeout(() => {
        setEntries(prev => prev.map(e =>
          (e.ip || e.country_code) === (entry.ip || entry.country_code)
            ? { ...e, _live: false }
            : e
        ));
      }, 1400);
    }, []),
  });

  /* ── Manual IP lookup ── */
  const handleLookup = async () => {
    const ip = lookupQuery.trim();
    if (!ip) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await ipAPI.getIntel(ip);
      // backend returns heatmap[] — find or build entry
      const list = res?.heatmap || res || [];
      const found = Array.isArray(list) && list.length > 0
        ? normaliseEntry({ ...list[0], ip })
        : normaliseEntry({ ip, country: 'Unknown', avg_abuse: 0, count: 0 });
      setLookupResult(found);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  /* ── Derived data ── */
  const allTags = useMemo(() =>
    [...new Set(entries.flatMap(e => e.tags))].sort(),
  [entries]);

  const results = useMemo(() => {
    let list = entries.filter(e => {
      const q = query.trim().toLowerCase();
      const matchQ  = !q ||
        (e.ip || '').toLowerCase().includes(q) ||
        (e.country || '').toLowerCase().includes(q) ||
        (e.isp || '').toLowerCase().includes(q) ||
        e.tags.some(t => t.includes(q));
      const matchR   = e.risk >= riskMin;
      const matchTag = !activeTag || e.tags.includes(activeTag);
      return matchQ && matchR && matchTag;
    });
    if (sortBy === 'risk')    list = [...list].sort((a, b) => b.risk - a.risk);
    if (sortBy === 'recent')  list = [...list].sort((a, b) => new Date(b.seen) - new Date(a.seen));
    if (sortBy === 'country') list = [...list].sort((a, b) => (a.country || '').localeCompare(b.country || ''));
    if (sortBy === 'attacks') list = [...list].sort((a, b) => b.count - a.count);
    return list;
  }, [entries, query, riskMin, activeTag, sortBy]);

  const threatFlags = stats?.threat_flags || {};

  return (
    <div style={{ padding: 'var(--space-6, 1.5rem)', fontFamily: 'inherit', color: 'var(--color-text)', maxWidth: '100%' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
            </svg>
            IP Explorer
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            IP intelligence · geo enrichment · threat scoring
            {isOffline && <span style={{ marginLeft: '0.5rem', color: 'var(--color-warning)', fontWeight: 600 }}>· OFFLINE MODE</span>}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontSize: '0.75rem', padding: '0.35rem 0.875rem',
            borderRadius: '0.375rem', cursor: loading ? 'wait' : 'pointer',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)', fontWeight: 500,
            opacity: loading ? 0.5 : 1,
          }}
        >{loading ? 'Refreshing…' : '↺ Refresh'}</button>
      </div>

      {/* ── Stats header chips ── */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1.375rem' }}>
        <StatChip label="Unique Countries"  value={threatFlags.unique_countries ?? entries.length} accent="var(--color-primary)" />
        <StatChip label="TOR Attacks"       value={threatFlags.tor_attacks}     accent="var(--color-notification)" />
        <StatChip label="Proxy Attacks"     value={threatFlags.proxy_attacks}   accent="var(--color-warning)" />
        <StatChip label="High Abuse IPs"    value={threatFlags.high_abuse}      accent="var(--color-gold)" />
        <StatChip label="Total Intel"       value={entries.length}              accent="var(--color-text-muted)" />
      </div>

      {/* ── Manual IP Lookup ── */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '0.5rem',
        padding: '0.875rem 1rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Manual IP Lookup
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            ref={lookupInputRef}
            type="text"
            placeholder="Enter IP address (e.g. 185.220.101.47)"
            value={lookupQuery}
            onChange={e => setLookupQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            style={{
              flex: '1 1 260px',
              padding: '0.5rem 0.75rem',
              background: 'var(--color-surface-offset, rgba(255,255,255,0.04))',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem', color: 'inherit',
              fontSize: '0.875rem', fontFamily: 'monospace', outline: 'none',
            }}
          />
          <button
            onClick={handleLookup}
            disabled={lookupLoading || !lookupQuery.trim()}
            style={{
              padding: '0.5rem 1.125rem',
              background: 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: '0.375rem',
              cursor: lookupLoading || !lookupQuery.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontWeight: 600,
              opacity: lookupLoading || !lookupQuery.trim() ? 0.55 : 1,
              transition: 'opacity 150ms',
            }}
          >{lookupLoading ? 'Looking up…' : 'LOOKUP'}</button>
        </div>

        {/* Lookup result */}
        {lookupError && (
          <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: 'var(--color-notification)' }}>
            ⚠ {lookupError}
          </div>
        )}
        {lookupResult && !lookupError && (
          <div style={{ marginTop: '0.75rem', animation: 'expandIn 180ms ease' }}>
            <IpRow
              entry={lookupResult}
              isSelected={selected?.ip === lookupResult.ip}
              onSelect={(e) => setSelected(prev => prev?.ip === e.ip ? null : e)}
              onBlock={() => {}}
            />
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && !isOffline && (
        <div style={{
          background: 'var(--color-notification, #ef4444)11',
          border: '1px solid var(--color-notification, #ef4444)44',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.8125rem', color: 'var(--color-notification)',
        }}>
          <span>⚠ {error}</span>
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 600, fontSize: '0.75rem' }}>RETRY</button>
        </div>
      )}

      {/* ── Search + Sort bar ── */}
      <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text" placeholder="Search IP, country, ISP, tag…"
            value={query} onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.45rem 0.75rem 0.45rem 2.1rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem', color: 'inherit',
              fontSize: '0.8125rem', outline: 'none',
            }}
          />
        </div>
        <select
          value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '0.45rem 0.75rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem', color: 'inherit',
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
          <option value="risk">Sort: Risk Score</option>
          <option value="attacks">Sort: Attack Count</option>
          <option value="recent">Sort: Most Recent</option>
          <option value="country">Sort: Country A–Z</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Min risk:</span>
          <input
            type="range" min="0" max="100" step="10" value={riskMin}
            onChange={e => setRiskMin(Number(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--color-primary)' }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '2ch', color: 'var(--color-text)' }}>{riskMin}</span>
        </div>
      </div>

      {/* ── Tag filters ── */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {['All', ...allTags].map(tag => {
            const isAll    = tag === 'All';
            const isActive = isAll ? !activeTag : activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(isAll ? null : (activeTag === tag ? null : tag))}
                style={{
                  fontSize: '0.6875rem', padding: '0.2rem 0.6rem', borderRadius: '9999px',
                  cursor: 'pointer',
                  background: isActive ? 'color-mix(in oklab, var(--color-primary) 18%, transparent)' : 'var(--color-surface)',
                  border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  transition: 'all 140ms',
                }}
              >{tag}</button>
            );
          })}
        </div>
      )}

      {/* ── Result count ── */}
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.625rem' }}>
        {loading ? 'Loading intelligence…' : `${results.length} entr${results.length !== 1 ? 'ies' : 'y'}`}
        {activeTag && <span style={{ marginLeft: '0.375rem', color: 'var(--color-primary)' }}>· filtered by «{activeTag}»</span>}
      </div>

      {/* ── Results ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : results.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '0.5rem',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ margin: '0 auto 1rem', opacity: 0.25 }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p style={{ margin: '0 0 1rem', fontWeight: 600 }}>No entries match your filters</p>
          <button
            onClick={() => { setQuery(''); setRiskMin(0); setActiveTag(null); }}
            style={{
              fontSize: '0.75rem', padding: '0.4rem 1rem',
              background: 'var(--color-surface-offset, rgba(255,255,255,0.06))',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontWeight: 500,
            }}
          >Clear filters</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {results.map(entry => (
            <IpRow
              key={entry.ip + entry.country_code}
              entry={entry}
              isSelected={selected?.ip === entry.ip && selected?.country_code === entry.country_code}
              onSelect={(e) => setSelected(prev =>
                prev?.ip === e.ip && prev?.country_code === e.country_code ? null : e
              )}
              onBlock={(ip) => setEntries(prev => prev.filter(e => e.ip !== ip))}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes expandIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes rowFlash {
          0%   { background: color-mix(in oklab, var(--color-primary) 14%, var(--color-surface)); }
          100% { background: var(--color-surface); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .skel-pulse {
          background: linear-gradient(
            90deg,
            var(--color-surface-offset, rgba(255,255,255,0.05)) 25%,
            var(--color-surface-dynamic, rgba(255,255,255,0.09)) 50%,
            var(--color-surface-offset, rgba(255,255,255,0.05)) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        input[type=range]::-webkit-slider-thumb { cursor: pointer; }
      `}</style>
    </div>
  );
}
