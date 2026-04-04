/**
 * BlocklistPage — Overhauled UI/UX
 *
 * Improvements over v1:
 *  - Stats bar (total blocked, permanent, expiring, nexus-auto blocks)
 *  - Search + filter by type (All / Permanent / Temporary / Nexus / Manual)
 *  - Expiry badge: PERMANENT vs time-remaining countdown
 *  - Shows attackType, blockedBy fields from backend
 *  - Inline confirmation before remove (no window.alert)
 *  - durationMinutes field in Add form (0 = permanent)
 *  - Skeleton loading state
 *  - Proper API field mapping (data.data array, DELETE by ip not _id)
 */
import { useState, useEffect, useCallback } from 'react';
import { blocklistAPI } from '../services/api';

// ── helpers ──────────────────────────────────────────────────────────────────
function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ATTACK_TYPE_LABELS = {
  sqli: 'SQLi', xss: 'XSS', traversal: 'Traversal',
  command_injection: 'CMDi', ssrf: 'SSRF', lfi_rfi: 'LFI/RFI',
  brute_force: 'Brute Force', hpp: 'HPP', xxe: 'XXE',
  webshell: 'Webshell', 'nexus-approved': 'Nexus', manual: 'Manual',
};

const TYPE_COLOR = {
  sqli: '#f59e0b', xss: '#ec4899', traversal: '#8b5cf6',
  command_injection: '#ef4444', ssrf: '#f97316', lfi_rfi: '#06b6d4',
  brute_force: '#ff3d71', hpp: '#a78bfa', xxe: '#84cc16',
  webshell: '#fb923c', 'nexus-approved': '#00F5FF', manual: '#6B7894',
};

function AttackBadge({ type }) {
  const label = ATTACK_TYPE_LABELS[type] || type || 'Unknown';
  const color = TYPE_COLOR[type] || '#6B7894';
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}40`,
      color, borderRadius: 4, padding: '1px 7px',
      fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.05em',
    }}>{label}</span>
  );
}

function ExpiryBadge({ expiresAt }) {
  if (!expiresAt) return (
    <span style={{
      background: 'rgba(255,61,113,0.12)', border: '1px solid rgba(255,61,113,0.35)',
      color: '#ff3d71', borderRadius: 4, padding: '1px 7px',
      fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em',
    }}>PERMANENT</span>
  );
  const left = timeUntil(expiresAt);
  return (
    <span style={{
      background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.35)',
      color: '#fb923c', borderRadius: 4, padding: '1px 7px',
      fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.05em',
    }}>⏱ {left}</span>
  );
}

// ── Confirmation modal ────────────────────────────────────────────────────────
function ConfirmModal({ ip, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d1117', border: '1px solid rgba(255,61,113,0.25)',
        borderRadius: 10, padding: '28px 32px', maxWidth: 380, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 13, color: '#B8C4E0', fontFamily: 'monospace', marginBottom: 6 }}>
          Unblock IP
        </div>
        <div style={{
          fontSize: 18, color: '#ff3d71', fontFamily: 'monospace',
          fontWeight: 700, marginBottom: 16, wordBreak: 'break-all',
        }}>{ip}</div>
        <div style={{ fontSize: 12, color: '#6B7894', fontFamily: 'monospace', marginBottom: 24 }}>
          This IP will be removed from the blocklist immediately. Incoming requests will no longer be blocked.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '7px 18px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: '#6B7894', cursor: 'pointer', letterSpacing: '0.05em',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '7px 18px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
            background: 'rgba(255,61,113,0.15)', border: '1px solid rgba(255,61,113,0.4)',
            color: '#ff3d71', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.05em',
          }}>Unblock</button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}>
      {[120, 180, 90, 80, 100, 60].map((w, j) => (
        <td key={j} className="px-4 py-3">
          <div style={{
            height: 12, width: w, borderRadius: 4,
            background: 'rgba(255,255,255,0.05)',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  ));
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BlocklistPage() {
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all'); // all | permanent | temporary | nexus | manual
  const [confirmIP, setConfirmIP]   = useState(null);  // IP pending removal confirmation
  const [removing, setRemoving]     = useState(null);  // IP currently being removed
  const [toast, setToast]           = useState(null);  // { msg, type: 'ok'|'err' }

  // Add-form state
  const [newIP, setNewIP]           = useState('');
  const [newReason, setNewReason]   = useState('');
  const [newDuration, setNewDuration] = useState('');  // minutes, '' = permanent
  const [adding, setAdding]         = useState(false);

  // ── load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await blocklistAPI.getAll();
      const body = res?.data ?? res;
      // Backend returns { success, count, data: [...] }
      const list = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
        ? body
        : [];
      setEntries(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── add ────────────────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault();
    if (!newIP.trim()) return;
    setAdding(true);
    try {
      const durationMinutes = newDuration ? parseInt(newDuration, 10) : undefined;
      await blocklistAPI.addEntry({
        ip: newIP.trim(),
        reason: newReason.trim() || 'Manual block',
        attackType: 'manual',
        blockedBy: 'operator',
        ...(durationMinutes ? { durationMinutes } : {}),
      });
      setNewIP(''); setNewReason(''); setNewDuration('');
      showToast(`${newIP.trim()} blocked successfully`, 'ok');
      await load();
    } catch (err) {
      showToast('Add failed: ' + err.message, 'err');
    } finally {
      setAdding(false);
    }
  }

  // ── remove ─────────────────────────────────────────────────────────────────
  async function doRemove(ip) {
    setConfirmIP(null);
    setRemoving(ip);
    try {
      // Backend DELETE /api/blocklist/:ip (by IP string, not _id)
      await blocklistAPI.remove(ip);
      setEntries(prev => prev.filter(e => e.ip !== ip));
      showToast(`${ip} unblocked`, 'ok');
    } catch (err) {
      showToast('Remove failed: ' + err.message, 'err');
    } finally {
      setRemoving(null);
    }
  }

  // ── toast ──────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── derived ────────────────────────────────────────────────────────────────
  const stats = {
    total:     entries.length,
    permanent: entries.filter(e => !e.expiresAt).length,
    temporary: entries.filter(e =>  e.expiresAt).length,
    nexus:     entries.filter(e => e.attackType === 'nexus-approved' || e.blockedBy?.includes('nexus') || e.blockedBy?.includes('sentinal')).length,
  };

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.ip.includes(q) || (e.reason || '').toLowerCase().includes(q) || (e.attackType || '').toLowerCase().includes(q);
    const matchFilter =
      filter === 'all'       ? true :
      filter === 'permanent' ? !e.expiresAt :
      filter === 'temporary' ? !!e.expiresAt :
      filter === 'nexus'     ? (e.attackType === 'nexus-approved' || (e.blockedBy || '').includes('nexus') || (e.blockedBy || '').includes('sentinal')) :
      filter === 'manual'    ? e.attackType === 'manual' :
      true;
    return matchSearch && matchFilter;
  });

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.9; }
          100% { opacity: 0.4; }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bl-filter-btn {
          padding: 5px 12px; border-radius: 5px; font-family: monospace;
          font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
          cursor: pointer; transition: all 0.15s;
          background: transparent; border: 1px solid rgba(0,245,255,0.12); color: #6B7894;
        }
        .bl-filter-btn.active {
          background: rgba(0,245,255,0.1); border-color: rgba(0,245,255,0.35); color: #00F5FF;
        }
        .bl-filter-btn:hover:not(.active) { border-color: rgba(0,245,255,0.25); color: #B8C4E0; }
        .bl-row:hover { background: rgba(0,245,255,0.025); }
        .bl-remove-btn {
          padding: 4px 12px; border-radius: 5px; font-family: monospace;
          font-size: 10px; letter-spacing: 0.05em; cursor: pointer; transition: all 0.15s;
          background: rgba(255,61,113,0.08); border: 1px solid rgba(255,61,113,0.25); color: #ff3d71;
        }
        .bl-remove-btn:hover:not(:disabled) { background: rgba(255,61,113,0.18); border-color: rgba(255,61,113,0.5); }
        .bl-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .bl-input {
          padding: 7px 12px; border-radius: 6px; font-family: monospace; font-size: 12px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(0,245,255,0.15);
          color: #B8C4E0; outline: none; transition: border-color 0.15s;
        }
        .bl-input:focus { border-color: rgba(0,245,255,0.45); }
        .bl-input::placeholder { color: #3D4663; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          padding: '10px 18px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          background: toast.type === 'ok' ? 'rgba(0,245,255,0.1)' : 'rgba(255,61,113,0.12)',
          border: `1px solid ${toast.type === 'ok' ? 'rgba(0,245,255,0.35)' : 'rgba(255,61,113,0.35)'}`,
          color: toast.type === 'ok' ? '#00F5FF' : '#ff3d71',
          animation: 'toastIn 0.2s ease-out',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>{toast.msg}</div>
      )}

      {/* Confirm modal */}
      {confirmIP && (
        <ConfirmModal
          ip={confirmIP}
          onConfirm={() => doRemove(confirmIP)}
          onCancel={() => setConfirmIP(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6B7894', marginBottom: 4 }}>
              Security · Blocklist
            </div>
            <h1 style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#00F5FF', margin: 0 }}>
              IP Blocklist
            </h1>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '6px 14px', borderRadius: 6, fontFamily: 'monospace', fontSize: 10,
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
            background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.2)',
            color: '#00F5FF', opacity: loading ? 0.5 : 1, transition: 'all 0.15s',
          }}>↻ Refresh</button>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Total Blocked', value: stats.total,     color: '#00F5FF' },
            { label: 'Permanent',     value: stats.permanent, color: '#ff3d71' },
            { label: 'Temporary',     value: stats.temporary, color: '#fb923c' },
            { label: 'Auto (Nexus)',  value: stats.nexus,     color: '#8b5cf6' },
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

        {/* ── Add form ── */}
        <div style={{
          background: 'rgba(0,245,255,0.03)', border: '1px solid rgba(0,245,255,0.1)',
          borderRadius: 10, padding: '16px 20px',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7894', marginBottom: 12 }}>
            Block New IP
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7894', letterSpacing: '0.06em', textTransform: 'uppercase' }}>IP Address *</label>
              <input
                className="bl-input"
                value={newIP}
                onChange={e => setNewIP(e.target.value)}
                placeholder="192.168.1.1"
                style={{ width: 170 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7894', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reason</label>
              <input
                className="bl-input"
                value={newReason}
                onChange={e => setNewReason(e.target.value)}
                placeholder="Brute force, manual review…"
                style={{ width: 230 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7894', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Duration (mins)</label>
              <input
                className="bl-input"
                value={newDuration}
                onChange={e => setNewDuration(e.target.value)}
                placeholder="blank = permanent"
                type="number" min="1"
                style={{ width: 150 }}
              />
            </div>
            <button
              type="submit"
              disabled={adding || !newIP.trim()}
              style={{
                padding: '7px 18px', borderRadius: 6, fontFamily: 'monospace', fontSize: 11,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                background: adding || !newIP.trim() ? 'rgba(0,245,255,0.04)' : 'rgba(0,245,255,0.12)',
                border: '1px solid rgba(0,245,255,0.3)', color: '#00F5FF',
                opacity: adding || !newIP.trim() ? 0.45 : 1, transition: 'all 0.15s',
              }}
            >
              {adding ? 'Blocking…' : '+ Block IP'}
            </button>
          </form>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
            background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)', color: '#ff3d71',
          }}>⚠ {error}</div>
        )}

        {/* ── Search + Filter ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="bl-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search IP, reason, type…"
            style={{ width: 240, flexShrink: 0 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'permanent', 'temporary', 'nexus', 'manual'].map(f => (
              <button
                key={f}
                className={`bl-filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? `All (${entries.length})` :
                 f === 'permanent' ? `Permanent (${stats.permanent})` :
                 f === 'temporary' ? `Temporary (${stats.temporary})` :
                 f === 'nexus'     ? `Nexus (${stats.nexus})` :
                 `Manual`}
              </button>
            ))}
          </div>
          {search && (
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7894' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,245,255,0.08)' }}>
          <table style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(0,245,255,0.04)', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
                {['IP Address', 'Type', 'Reason', 'Blocked At', 'Expires', 'Action'].map(h => (
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
                  <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#3D4663', fontFamily: 'monospace', fontSize: 12 }}>
                    {search || filter !== 'all' ? 'No entries match your filter.' : 'Blocklist is empty — no IPs currently blocked.'}
                  </td>
                </tr>
              ) : filtered.map(e => (
                <tr
                  key={e._id ?? e.ip}
                  className="bl-row"
                  style={{ borderBottom: '1px solid rgba(0,245,255,0.04)', transition: 'background 0.12s' }}
                >
                  {/* IP */}
                  <td style={{ padding: '11px 16px', color: '#ff3d71', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {e.ip}
                  </td>
                  {/* Type */}
                  <td style={{ padding: '11px 16px' }}>
                    <AttackBadge type={e.attackType} />
                  </td>
                  {/* Reason */}
                  <td style={{ padding: '11px 16px', color: '#B8C4E0', maxWidth: 220 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.reason}>
                      {e.reason || '—'}
                    </span>
                    {e.blockedBy && (
                      <span style={{ fontSize: 10, color: '#3D4663', display: 'block', marginTop: 2 }}>
                        by {e.blockedBy}
                      </span>
                    )}
                  </td>
                  {/* Blocked At */}
                  <td style={{ padding: '11px 16px', color: '#6B7894', whiteSpace: 'nowrap' }}>
                    {fmtDate(e.blockedAt || e.createdAt)}
                  </td>
                  {/* Expires */}
                  <td style={{ padding: '11px 16px' }}>
                    <ExpiryBadge expiresAt={e.expiresAt} />
                  </td>
                  {/* Action */}
                  <td style={{ padding: '11px 16px' }}>
                    <button
                      className="bl-remove-btn"
                      disabled={removing === e.ip}
                      onClick={() => setConfirmIP(e.ip)}
                    >
                      {removing === e.ip ? 'Removing…' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer count ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#3D4663', textAlign: 'right', letterSpacing: '0.05em' }}>
            Showing {filtered.length} of {entries.length} blocked IP{entries.length !== 1 ? 's' : ''}
          </div>
        )}

      </div>
    </>
  );
}
