/**
 * PcapPage  (v3)
 *
 * Fixed:
 *  - Calls pcapAPI.getSessions() which now hits GET /api/pcap (MongoDB, no microservice)
 *  - Upload no longer double-wraps FormData — passes raw File to pcapAPI.upload()
 *  - Shows upload result summary (packets, flows, attacks saved)
 *  - Severity + confidence badges
 *  - Clear "processor offline" banner when upload returns 503 PCAP_PROCESSOR_OFFLINE
 *  - Skeleton loading rows
 *  - Toast notifications replacing window.alert()
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { pcapAPI } from '../services/api';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SEV_COLOR = {
  critical: '#ff3d71', high: '#fb923c',
  medium:   '#f59e0b', low:  '#6B7894',
};

function SevBadge({ sev }) {
  const color = SEV_COLOR[sev] || '#6B7894';
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}40`,
      color, borderRadius: 4, padding: '1px 7px',
      fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>{sev || '—'}</span>
  );
}

function ConfBadge({ conf }) {
  if (conf == null) return <span style={{ color: '#3D4663', fontFamily: 'monospace', fontSize: 11 }}>—</span>;
  const pct = Math.round(conf * 100);
  const color = pct >= 75 ? '#00F5FF' : pct >= 40 ? '#fb923c' : '#ff3d71';
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 11, color }}>{pct}%</span>
  );
}

function SkeletonRows() {
  return Array.from({ length: 6 }).map((_, i) => (
    <tr key={i} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}>
      {[120, 110, 80, 80, 55, 120, 60].map((w, j) => (
        <td key={j} style={{ padding: '11px 16px' }}>
          <div style={{
            height: 11, width: w, borderRadius: 4,
            background: 'rgba(255,255,255,0.05)',
            animation: 'pcap-shimmer 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  ));
}

// ── Upload result banner ──────────────────────────────────────────────────────
function ResultBanner({ result, onClose }) {
  if (!result) return null;
  const isOffline = result.code === 'PCAP_PROCESSOR_OFFLINE';
  const isOk      = result.success;
  const color     = isOffline ? '#fb923c' : isOk ? '#00F5FF' : '#ff3d71';
  return (
    <div style={{
      padding: '14px 18px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
      background: `${color}0d`, border: `1px solid ${color}30`, color,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        {isOffline && (
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ PCAP Processor Offline</div>
        )}
        {isOk ? (
          <div>
            <span style={{ fontWeight: 700 }}>✓ Processed — </span>
            {result.data?.attacks_saved ?? 0} attack(s) saved
            {result.data?.total_packets != null && (
              <span style={{ color: '#6B7894' }}>
                {' '}· {result.data.total_packets} packets · {result.data.total_flows} flows
                {' '}· {result.data.processing_time_s?.toFixed(2)}s
              </span>
            )}
          </div>
        ) : (
          <div>{result.message}</div>
        )}
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PcapPage() {
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [search,    setSearch]    = useState('');
  const [toast,     setToast]     = useState(null);
  const fileRef = useRef(null);

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await pcapAPI.getSessions();
      // Backend returns { sessions: [...] } inside data
      const list = Array.isArray(data?.sessions)
        ? data.sessions
        : Array.isArray(data)
        ? data
        : [];
      setSessions(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── upload ────────────────────────────────────────────────────────────────
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      // Pass raw File — pcapAPI.upload() builds FormData internally with field 'pcap'
      const res = await pcapAPI.upload(file);
      setUploadResult({ success: true, ...(res?.data ?? res) });
      await load();
    } catch (err) {
      // Show structured result for known errors (503 processor offline)
      setUploadResult({ success: false, message: err.message, code: err.code });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = sessions.filter(s =>
    !q ||
    (s.src || '').includes(q) ||
    (s.protocol || '').toLowerCase().includes(q) ||
    (s.severity || '').toLowerCase().includes(q) ||
    (s.payload  || '').toLowerCase().includes(q)
  );

  const stats = {
    total:    sessions.length,
    critical: sessions.filter(s => s.severity === 'critical').length,
    high:     sessions.filter(s => s.severity === 'high').length,
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes pcap-shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.9; }
          100% { opacity: 0.4; }
        }
        @keyframes pcap-toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pcap-row:hover { background: rgba(0,245,255,0.025); }
        .pcap-input {
          padding: 7px 12px; border-radius: 6px;
          font-family: monospace; font-size: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(0,245,255,0.15);
          color: #B8C4E0; outline: none; transition: border-color 0.15s;
        }
        .pcap-input:focus { border-color: rgba(0,245,255,0.45); }
        .pcap-input::placeholder { color: #3D4663; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          padding: '10px 18px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          background: toast.type === 'ok' ? 'rgba(0,245,255,0.1)' : 'rgba(255,61,113,0.12)',
          border: `1px solid ${toast.type === 'ok' ? 'rgba(0,245,255,0.35)' : 'rgba(255,61,113,0.35)'}`,
          color: toast.type === 'ok' ? '#00F5FF' : '#ff3d71',
          animation: 'pcap-toastIn 0.2s ease-out',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>{toast.msg}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B7894', marginBottom: 4 }}>
              Security · PCAP Analysis
            </div>
            <h1 style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#00F5FF', margin: 0 }}>
              PCAP Sessions
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{
              cursor: uploading ? 'not-allowed' : 'pointer',
              padding: '7px 16px', borderRadius: 6, fontFamily: 'monospace',
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)',
              color: uploading ? '#3D4663' : '#00FF88', transition: 'all 0.15s',
              opacity: uploading ? 0.6 : 1,
            }}>
              {uploading ? 'Uploading…' : '↑ Upload .pcap'}
              <input ref={fileRef} type="file" accept=".pcap,.pcapng" onChange={handleUpload}
                style={{ display: 'none' }} disabled={uploading} />
            </label>
            <button onClick={load} disabled={loading} style={{
              padding: '7px 16px', borderRadius: 6, fontFamily: 'monospace',
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.2)',
              color: '#00F5FF', cursor: 'pointer', opacity: loading ? 0.5 : 1,
            }}>↺ Refresh</button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Total Events',  value: stats.total,    color: '#00F5FF' },
            { label: 'Critical',      value: stats.critical, color: '#ff3d71' },
            { label: 'High',          value: stats.high,     color: '#fb923c' },
          ].map(s => (
            <div key={s.label} style={{
              background: `${s.color}0a`, border: `1px solid ${s.color}20`,
              borderRadius: 8, padding: '12px 16px',
            }}>
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {loading ? '—' : s.value}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7894', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Processor-offline / upload result banner */}
        <ResultBanner result={uploadResult} onClose={() => setUploadResult(null)} />

        {/* Processor offline info when no upload tried yet */}
        {!uploadResult && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 11,
            background: 'rgba(107,120,148,0.06)', border: '1px solid rgba(107,120,148,0.15)',
            color: '#6B7894', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: '#fb923c' }}>ℹ</span>
            The table below shows all detected attack events from MongoDB.
            To process a new .pcap file, start the <span style={{ color: '#00F5FF' }}>pcap-processor</span> service on port 8003, then upload.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
            background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)', color: '#ff3d71',
          }}>⚠ {error}</div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="pcap-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search IP, type, severity…"
            style={{ width: 260 }}
          />
          {search && (
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7894' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,245,255,0.08)' }}>
          <table style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,245,255,0.04)', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
                {['Source IP', 'Attack Type', 'Severity', 'Confidence', 'Status', 'Captured At', 'Detected By'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: '#6B7894', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{
                    padding: '48px 16px', textAlign: 'center',
                    color: '#3D4663', fontFamily: 'monospace', fontSize: 12,
                  }}>
                    {search
                      ? 'No sessions match your search.'
                      : 'No attack events yet. Upload a .pcap file or run a simulation to generate data.'}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr
                  key={s.sessionId}
                  className="pcap-row"
                  style={{ borderBottom: '1px solid rgba(0,245,255,0.04)', transition: 'background 0.12s' }}
                >
                  <td style={{ padding: '11px 16px', color: '#ff3d71', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {s.src || '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#00F5FF' }}>
                    {s.protocol || '—'}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <SevBadge sev={s.severity} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <ConfBadge conf={s.confidence} />
                  </td>
                  <td style={{ padding: '11px 16px', color: '#B8C4E0', textTransform: 'capitalize' }}>
                    {s.status || '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#6B7894', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.capturedAt)}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#6B7894' }}>
                    {s.detectedBy || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#3D4663', textAlign: 'right', letterSpacing: '0.05em' }}>
            Showing {filtered.length} of {sessions.length} event{sessions.length !== 1 ? 's' : ''}
          </div>
        )}

      </div>
    </>
  );
}
