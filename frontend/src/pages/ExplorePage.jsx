import React, { useState, useMemo } from 'react';

const MOCK_IPS = [
  { ip: '185.220.101.47', country: 'Russia',      isp: 'Frantech Solutions',   type: 'Tor Exit Node',  risk: 95, tags: ['tor','malicious','scanner'],  seen: '2026-04-04T08:12:00Z' },
  { ip: '103.21.244.0',   country: 'China',       isp: 'Cloudflare',          type: 'CDN / Proxy',    risk: 12, tags: ['cdn','proxy'],                seen: '2026-04-03T14:55:00Z' },
  { ip: '45.33.32.156',   country: 'USA',         isp: 'Linode LLC',          type: 'VPS',            risk: 48, tags: ['cloud','vps'],                 seen: '2026-04-04T07:01:00Z' },
  { ip: '91.121.87.0',    country: 'France',      isp: 'OVH SAS',             type: 'Hosting',        risk: 63, tags: ['hosting','brute-force'],       seen: '2026-04-03T22:33:00Z' },
  { ip: '196.188.0.0',    country: 'Ethiopia',    isp: 'Ethio Telecom',       type: 'ISP',            risk: 81, tags: ['c2','malicious'],              seen: '2026-04-04T05:49:00Z' },
  { ip: '89.248.167.0',   country: 'Netherlands', isp: 'Shadowserver',        type: 'Research',       risk: 5,  tags: ['research','scanner'],          seen: '2026-04-02T11:20:00Z' },
  { ip: '144.126.0.0',    country: 'USA',         isp: 'DigitalOcean',        type: 'VPS',            risk: 72, tags: ['vps','spam','malicious'],      seen: '2026-04-04T03:14:00Z' },
  { ip: '5.188.206.0',    country: 'Russia',      isp: 'SELECTEL',            type: 'Hosting',        risk: 88, tags: ['ransomware','c2'],             seen: '2026-04-04T09:05:00Z' },
];

const RISK_COLOR = (r) => r >= 80 ? '#ef4444' : r >= 60 ? '#f97316' : r >= 40 ? '#eab308' : '#22c55e';
const RISK_LABEL = (r) => r >= 80 ? 'CRITICAL' : r >= 60 ? 'HIGH' : r >= 40 ? 'MEDIUM' : 'LOW';

const ALL_TAGS = [...new Set(MOCK_IPS.flatMap(i => i.tags))];

export default function ExplorePage() {
  const [query,     setQuery]     = useState('');
  const [riskMin,   setRiskMin]   = useState(0);
  const [activeTag, setActiveTag] = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [sortBy,    setSortBy]    = useState('risk');

  const results = useMemo(() => {
    let list = MOCK_IPS.filter(ip => {
      const q = query.trim().toLowerCase();
      const matchQuery = !q ||
        ip.ip.includes(q) ||
        ip.country.toLowerCase().includes(q) ||
        ip.isp.toLowerCase().includes(q) ||
        ip.tags.some(t => t.includes(q));
      const matchRisk = ip.risk >= riskMin;
      const matchTag  = !activeTag || ip.tags.includes(activeTag);
      return matchQuery && matchRisk && matchTag;
    });
    if (sortBy === 'risk')    list = [...list].sort((a, b) => b.risk - a.risk);
    if (sortBy === 'recent')  list = [...list].sort((a, b) => new Date(b.seen) - new Date(a.seen));
    if (sortBy === 'country') list = [...list].sort((a, b) => a.country.localeCompare(b.country));
    return list;
  }, [query, riskMin, activeTag, sortBy]);

  const s = { // shared inline styles
    card: {
      background: 'var(--color-surface, #1e293b)',
      border: '1px solid var(--color-border, #334155)',
      borderRadius: '0.5rem',
    },
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'inherit', color: 'var(--color-text, #e2e8f0)' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
          IP Explorer
        </h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted, #94a3b8)' }}>
          IP intelligence, geo enrichment &amp; threat scoring
        </p>
      </div>

      {/* Search + Sort Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search IP, country, ISP, tag…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              background: 'var(--color-surface, #1e293b)',
              border: '1px solid var(--color-border, #334155)',
              borderRadius: '0.375rem', color: 'inherit', fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '0.375rem', color: 'inherit', fontSize: '0.875rem', cursor: 'pointer',
          }}>
          <option value="risk">Sort: Risk Score</option>
          <option value="recent">Sort: Most Recent</option>
          <option value="country">Sort: Country</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--color-text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>Min risk:</span>
          <input
            type="range" min="0" max="100" step="10" value={riskMin}
            onChange={e => setRiskMin(Number(e.target.value))}
            style={{ width: '80px', accentColor: '#60a5fa' }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '2.5ch' }}>{riskMin}</span>
        </div>
      </div>

      {/* Tag Filters */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveTag(null)}
          style={{
            fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', cursor: 'pointer',
            background: !activeTag ? 'rgba(96,165,250,0.2)' : 'var(--color-surface, #1e293b)',
            border: `1px solid ${!activeTag ? '#60a5fa' : 'var(--color-border, #334155)'}`,
            color: !activeTag ? '#60a5fa' : 'var(--color-text-muted, #94a3b8)',
          }}>All</button>
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            style={{
              fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', cursor: 'pointer',
              background: activeTag === tag ? 'rgba(96,165,250,0.2)' : 'var(--color-surface, #1e293b)',
              border: `1px solid ${activeTag === tag ? '#60a5fa' : 'var(--color-border, #334155)'}`,
              color: activeTag === tag ? '#60a5fa' : 'var(--color-text-muted, #94a3b8)',
            }}>{tag}</button>
        ))}
      </div>

      {/* Results Count */}
      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #94a3b8)', marginBottom: '0.75rem' }}>
        {results.length} result{results.length !== 1 ? 's' : ''}
      </div>

      {/* Results Grid */}
      {results.length === 0 ? (
        <div style={{ ...s.card, padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted, #94a3b8)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ margin: '0 auto 1rem', opacity: 0.3 }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p style={{ margin: 0 }}>No IPs match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {results.map(ip => (
            <div
              key={ip.ip}
              onClick={() => setSelected(selected?.ip === ip.ip ? null : ip)}
              style={{
                ...s.card,
                padding: '0.875rem 1.1rem',
                cursor: 'pointer',
                transition: 'border-color 120ms, background 120ms',
                borderColor: selected?.ip === ip.ip ? RISK_COLOR(ip.risk) + '66' : 'var(--color-border, #334155)',
                background: selected?.ip === ip.ip ? RISK_COLOR(ip.risk) + '0a' : 'var(--color-surface, #1e293b)',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Risk ring */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${RISK_COLOR(ip.risk)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.625rem', fontWeight: 700, color: RISK_COLOR(ip.risk),
                    fontVariantNumeric: 'tabular-nums',
                  }}>{ip.risk}</div>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9375rem', color: '#60a5fa' }}>{ip.ip}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)' }}>
                      {ip.country} · {ip.isp} · {ip.type}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {ip.tags.map(t => (
                    <span key={t} style={{
                      fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '9999px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--color-border, #334155)',
                      color: 'var(--color-text-muted, #94a3b8)',
                    }}>{t}</span>
                  ))}
                  <span style={{
                    fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
                    background: RISK_COLOR(ip.risk) + '22',
                    color: RISK_COLOR(ip.risk), fontWeight: 700, letterSpacing: '0.04em',
                  }}>{RISK_LABEL(ip.risk)}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {selected?.ip === ip.ip && (
                <div style={{
                  marginTop: '0.875rem', paddingTop: '0.875rem',
                  borderTop: '1px solid var(--color-border, #334155)',
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.625rem',
                  animation: 'fadeIn 150ms ease',
                }}>
                  {[
                    { label: 'IP Address',    value: ip.ip },
                    { label: 'Country',       value: ip.country },
                    { label: 'ISP / Org',     value: ip.isp },
                    { label: 'Type',          value: ip.type },
                    { label: 'Risk Score',    value: ip.risk + ' / 100' },
                    { label: 'Last Seen',     value: new Date(ip.seen).toLocaleString() },
                  ].map(f => (
                    <div key={f.label} style={{ fontSize: '0.8125rem' }}>
                      <div style={{ color: 'var(--color-text-muted, #94a3b8)', fontSize: '0.7rem', marginBottom: '0.1rem' }}>{f.label}</div>
                      <div style={{ fontWeight: 600 }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
