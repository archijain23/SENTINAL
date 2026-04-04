/**
 * PcapPage — Wired to pcapAPI
 *
 * GET  /api/pcap           → list captured sessions
 * POST /api/pcap/analyze   → trigger analysis
 */
import { useState, useEffect } from 'react';
import { pcapAPI } from '../services/api';

export default function PcapPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await pcapAPI.getSessions();
      const data = res?.data ?? res;
      setSessions(Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      await pcapAPI.analyze({ trigger: 'manual' });
      await load();
    } catch (err) {
      alert('Analysis failed: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-mono font-bold text-sm tracking-widest uppercase" style={{ color: '#00F5FF' }}>PCAP Sessions</h1>
        <button onClick={handleAnalyze} disabled={analyzing}
          className="font-mono text-xs px-4 py-2 rounded uppercase tracking-wider disabled:opacity-40 transition-all"
          style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', color: '#00F5FF' }}>
          {analyzing ? 'Analyzing…' : '▶ Run Analysis'}
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
              {['Session ID', 'Source', 'Destination', 'Protocol', 'Size', 'Captured At'].map(h => (
                <th key={h} className="px-4 py-3 text-left tracking-widest uppercase"
                  style={{ color: '#6B7894', fontSize: '10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>Loading…</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>No PCAP sessions captured yet.</td></tr>
            ) : sessions.map((s) => (
              <tr key={s._id ?? s.id ?? s.sessionId} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}
                className="hover:bg-[rgba(0,245,255,0.02)] transition-colors">
                <td className="px-4 py-3" style={{ color: '#00F5FF' }}>{s.sessionId ?? s._id ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{s.src ?? s.source ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{s.dst ?? s.destination ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{s.protocol ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: '#6B7894' }}>{s.size ? `${s.size} B` : '—'}</td>
                <td className="px-4 py-3" style={{ color: '#6B7894' }}>
                  {s.capturedAt ? new Date(s.capturedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
