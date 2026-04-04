/**
 * BlocklistPage — Wired to blocklistAPI
 *
 * GET    /api/blocklist    → list current blocked IPs
 * POST   /api/blocklist    → add new entry
 * DELETE /api/blocklist/:id → remove entry
 */
import { useState, useEffect } from 'react';
import { blocklistAPI } from '../services/api';

export default function BlocklistPage() {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [newIP, setNewIP]       = useState('');
  const [newReason, setNewReason] = useState('');
  const [adding, setAdding]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await blocklistAPI.getAll();
      const data = res?.data ?? res;
      setEntries(Array.isArray(data?.entries) ? data.entries : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newIP.trim()) return;
    setAdding(true);
    try {
      await blocklistAPI.addEntry({ ip: newIP.trim(), reason: newReason.trim() });
      setNewIP(''); setNewReason('');
      await load();
    } catch (err) {
      alert('Add failed: ' + err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id) {
    try {
      await blocklistAPI.remove(id);
      setEntries(prev => prev.filter(e => e._id !== id && e.id !== id));
    } catch (err) {
      alert('Remove failed: ' + err.message);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-mono font-bold text-sm tracking-widest uppercase" style={{ color: '#00F5FF' }}>IP Blocklist</h1>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] tracking-widest uppercase" style={{ color: '#6B7894' }}>IP Address</label>
          <input value={newIP} onChange={e => setNewIP(e.target.value)} placeholder="192.168.1.1"
            className="px-3 py-2 rounded font-mono text-xs bg-transparent outline-none"
            style={{ border: '1px solid rgba(0,245,255,0.2)', color: '#B8C4E0', width: '180px' }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] tracking-widest uppercase" style={{ color: '#6B7894' }}>Reason (optional)</label>
          <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Brute force"
            className="px-3 py-2 rounded font-mono text-xs bg-transparent outline-none"
            style={{ border: '1px solid rgba(0,245,255,0.2)', color: '#B8C4E0', width: '220px' }} />
        </div>
        <button type="submit" disabled={adding || !newIP.trim()}
          className="px-4 py-2 rounded font-mono text-xs uppercase tracking-wider disabled:opacity-40 transition-all"
          style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', color: '#00F5FF' }}>
          {adding ? 'Adding…' : '+ Block IP'}
        </button>
      </form>

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
              {['IP Address', 'Reason', 'Blocked At', 'Remove'].map(h => (
                <th key={h} className="px-4 py-3 text-left tracking-widest uppercase"
                  style={{ color: '#6B7894', fontSize: '10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>Blocklist is empty.</td></tr>
            ) : entries.map(e => (
              <tr key={e._id ?? e.id} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}
                className="hover:bg-[rgba(0,245,255,0.02)] transition-colors">
                <td className="px-4 py-3" style={{ color: '#FF3D71' }}>{e.ip}</td>
                <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{e.reason ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: '#6B7894' }}>
                  {e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleRemove(e._id ?? e.id)}
                    className="px-2 py-0.5 rounded text-[10px] transition-all"
                    style={{ background: 'rgba(255,61,113,0.1)', border: '1px solid rgba(255,61,113,0.3)', color: '#FF3D71' }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
