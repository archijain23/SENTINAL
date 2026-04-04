/**
 * NexusPage — Wired to nexusAPI + geminiAPI
 *
 * GET  /api/nexus/status   → model status
 * POST /api/nexus/analyze  → run ML analysis
 * POST /api/gemini/analyze → Gemini AI insight
 */
import { useState, useEffect } from 'react';
import { nexusAPI, geminiAPI } from '../services/api';

export default function NexusPage() {
  const [status, setStatus]       = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [input, setInput]         = useState('');
  const [result, setResult]       = useState(null);
  const [running, setRunning]     = useState(false);
  const [error, setError]         = useState(null);

  useEffect(() => {
    nexusAPI.getStatus()
      .then(res => setStatus(res?.data ?? res))
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false));
  }, []);

  async function handleAnalyze() {
    if (!input.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const [nexusRes, geminiRes] = await Promise.allSettled([
        nexusAPI.analyze({ payload: input }),
        geminiAPI.analyze({ prompt: input }),
      ]);
      setResult({
        nexus:  nexusRes.status  === 'fulfilled' ? nexusRes.value  : null,
        gemini: geminiRes.status === 'fulfilled' ? geminiRes.value : null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="font-mono font-bold text-sm tracking-widest uppercase" style={{ color: '#00F5FF' }}>NEXUS AI Engine</h1>

      {/* Model status badge */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#6B7894' }}>Model Status:</span>
        {statusLoading ? (
          <span style={{ color: '#6B7894' }} className="font-mono text-xs">⋯</span>
        ) : status ? (
          <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00FF88' }}>
            Online — {status.model ?? 'ready'}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider"
            style={{ background: 'rgba(255,61,113,0.1)', border: '1px solid rgba(255,61,113,0.3)', color: '#FF3D71' }}>
            Offline
          </span>
        )}
      </div>

      {/* Analysis input */}
      <div className="space-y-3">
        <label className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#6B7894' }}>Payload / Log to Analyze</label>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="Paste raw HTTP request, log entry, or payload for AI threat analysis…"
          rows={6}
          className="w-full px-4 py-3 rounded font-mono text-xs bg-transparent outline-none resize-none"
          style={{ border: '1px solid rgba(0,245,255,0.2)', color: '#B8C4E0', lineHeight: 1.8 }} />
        <button onClick={handleAnalyze} disabled={running || !input.trim()}
          className="px-5 py-2 rounded font-mono text-xs uppercase tracking-wider disabled:opacity-40 transition-all"
          style={{ background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)', color: '#00F5FF' }}>
          {running ? 'Analyzing…' : '▶ Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded text-xs font-mono"
          style={{ background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)', color: '#FF3D71' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Nexus ML */}
          <div className="p-4 rounded-lg space-y-2" style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)' }}>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#00F5FF' }}>Nexus ML Result</p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: '#B8C4E0', maxHeight: '300px', overflowY: 'auto' }}>
              {result.nexus ? JSON.stringify(result.nexus?.data ?? result.nexus, null, 2) : 'Service unavailable'}
            </pre>
          </div>
          {/* Gemini AI */}
          <div className="p-4 rounded-lg space-y-2" style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)' }}>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#00FF88' }}>Gemini AI Insight</p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all" style={{ color: '#B8C4E0', maxHeight: '300px', overflowY: 'auto' }}>
              {result.gemini ? JSON.stringify(result.gemini?.data ?? result.gemini, null, 2) : 'Service unavailable'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
