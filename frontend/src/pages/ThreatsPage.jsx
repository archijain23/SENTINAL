/**
 * ThreatsPage — Wired to attacksAPI
 *
 * Fetches paginated attack events from GET /api/attacks.
 * Shows a live-updating table with block/resolve actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { attacksAPI, actionsAPI } from '../services/api';
import { getSocket, SOCKET_EVENTS } from '../services/socket';

const SEVERITY_COLOR = {
  critical: '#FF3D71',
  high:     '#FF8C00',
  medium:   '#FFD700',
  low:      '#00FF88',
};

export default function ThreatsPage() {
  const [attacks, setAttacks]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const LIMIT = 20;

  const fetchAttacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attacksAPI.getAll({ page, limit: LIMIT });
      const data  = res?.data ?? res;
      setAttacks(Array.isArray(data?.attacks) ? data.attacks : Array.isArray(data) ? data : []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchAttacks(); }, [fetchAttacks]);

  // Real-time: prepend new attack to list
  useEffect(() => {
    const socket = getSocket();
    socket.on(SOCKET_EVENTS.NEW_ATTACK, (attack) => {
      setAttacks(prev => [attack, ...prev.slice(0, LIMIT - 1)]);
      setTotal(t => t + 1);
    });
    return () => socket.off(SOCKET_EVENTS.NEW_ATTACK);
  }, []);

  async function handleBlock(ip) {
    try {
      await actionsAPI.blockIP(ip);
      setAttacks(prev => prev.map(a => a.sourceIP === ip ? { ...a, status: 'blocked' } : a));
    } catch (err) {
      alert('Block failed: ' + err.message);
    }
  }

  async function handleResolve(id) {
    try {
      await attacksAPI.resolve(id);
      setAttacks(prev => prev.map(a => a._id === id ? { ...a, status: 'resolved' } : a));
    } catch (err) {
      alert('Resolve failed: ' + err.message);
    }
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <h1 className="font-mono font-bold text-sm tracking-widest uppercase" style={{ color: '#00F5FF' }}>
          Threat Events {total > 0 && <span style={{ color: '#6B7894' }}>({total.toLocaleString()})</span>}
        </h1>
        <button onClick={fetchAttacks}
          className="font-mono text-xs px-3 py-1.5 rounded transition-all"
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)', color: '#00F5FF' }}>
          ↺ Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded text-xs font-mono"
          style={{ background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)', color: '#FF3D71' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(0,245,255,0.08)' }}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ background: 'rgba(0,245,255,0.04)', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
              {['Time', 'Source IP', 'Type', 'Severity', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left tracking-widest uppercase"
                  style={{ color: '#6B7894', fontSize: '10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>Loading…</td></tr>
            ) : attacks.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>No threat events found.</td></tr>
            ) : attacks.map((a) => (
              <tr key={a._id ?? a.id} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}
                className="hover:bg-[rgba(0,245,255,0.02)] transition-colors">
                <td className="px-4 py-3" style={{ color: '#6B7894' }}>
                  {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '—'}
                </td>
                <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{a.sourceIP ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{a.type ?? a.attackType ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider"
                    style={{ color: SEVERITY_COLOR[a.severity?.toLowerCase()] ?? '#B8C4E0',
                             background: `${SEVERITY_COLOR[a.severity?.toLowerCase()] ?? '#B8C4E0'}18` }}>
                    {a.severity ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: a.status === 'blocked' ? '#FF3D71' : a.status === 'resolved' ? '#00FF88' : '#6B7894' }}>
                  {a.status ?? 'active'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {a.status !== 'blocked' && (
                      <button onClick={() => handleBlock(a.sourceIP)}
                        className="px-2 py-0.5 rounded text-[10px] transition-all"
                        style={{ background: 'rgba(255,61,113,0.1)', border: '1px solid rgba(255,61,113,0.3)', color: '#FF3D71' }}>
                        Block
                      </button>
                    )}
                    {a.status !== 'resolved' && (
                      <button onClick={() => handleResolve(a._id ?? a.id)}
                        className="px-2 py-0.5 rounded text-[10px] transition-all"
                        style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00FF88' }}>
                        Resolve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center gap-3 justify-end">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="font-mono text-xs px-3 py-1.5 rounded disabled:opacity-30 transition-all"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)', color: '#00F5FF' }}>
            ← Prev
          </button>
          <span className="font-mono text-xs" style={{ color: '#6B7894' }}>Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * LIMIT >= total}
            className="font-mono text-xs px-3 py-1.5 rounded disabled:opacity-30 transition-all"
            style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)', color: '#00F5FF' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
