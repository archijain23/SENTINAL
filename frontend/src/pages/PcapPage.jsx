/**
 * PcapPage — Wired to pcapAPI  (v2 — fixed analyze() signature + added upload)
 *
 * GET  /api/pcap                  → list sessions
 * GET  /api/pcap/:sessionId       → session detail (on row click)
 * POST /api/pcap/upload           → upload .pcap file
 * POST /api/pcap/:sessionId/analyze → analyze a specific session
 */
import { useState, useEffect, useRef } from 'react';
import { pcapAPI } from '../services/api';

export default function PcapPage() {
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null); // sessionId being analyzed
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await pcapAPI.getSessions();
      const data = res?.data ?? res;
      setSessions(Array.isArray(data?.sessions) ? data.sessions :
                  Array.isArray(data)             ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await pcapAPI.upload(fd);
      await load();
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleAnalyze(sessionId) {
    setAnalyzing(sessionId);
    try {
      // Correct signature: pcapAPI.analyze(sessionId, payload)
      await pcapAPI.analyze(sessionId, { trigger: 'manual' });
      await load();
    } catch (err) {
      alert('Analysis failed: ' + err.message);
    } finally {
      setAnalyzing(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-mono font-bold text-sm tracking-widest uppercase" style={{ color: '#00F5FF' }}>PCAP Sessions</h1>
        <div className="flex items-center gap-3">
          <label
            className="cursor-pointer font-mono text-xs px-4 py-2 rounded uppercase tracking-wider transition-all"
            style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', color: '#00FF88' }}>
            {uploading ? 'Uploading…' : '↑ Upload .pcap'}
            <input ref={fileRef} type="file" accept=".pcap,.pcapng" onChange={handleUpload} className="hidden" />
          </label>
          <button onClick={load}
            className="font-mono text-xs px-4 py-2 rounded uppercase tracking-wider transition-all"
            style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.25)', color: '#00F5FF' }}>
            ↺ Refresh
          </button>
        </div>
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
              {['Session ID', 'Source', 'Destination', 'Protocol', 'Size', 'Captured At', 'Analyze'].map(h => (
                <th key={h} className="px-4 py-3 text-left tracking-widest uppercase"
                  style={{ color: '#6B7894', fontSize: '10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>Loading…</td></tr>
            ) : sessions.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>No PCAP sessions captured yet. Upload a .pcap file to begin.</td></tr>
            ) : sessions.map((s) => {
              const sid = s.sessionId ?? s._id ?? s.id;
              return (
                <tr key={sid} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}
                  className="hover:bg-[rgba(0,245,255,0.02)] transition-colors">
                  <td className="px-4 py-3" style={{ color: '#00F5FF' }}>{sid ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{s.src ?? s.source ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{s.dst ?? s.destination ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{s.protocol ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#6B7894' }}>{s.size ? `${s.size} B` : '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#6B7894' }}>
                    {s.capturedAt ? new Date(s.capturedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleAnalyze(sid)}
                      disabled={analyzing === sid}
                      className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider disabled:opacity-40 transition-all"
                      style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)', color: '#00F5FF' }}>
                      {analyzing === sid ? '…' : '▶ Analyze'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
