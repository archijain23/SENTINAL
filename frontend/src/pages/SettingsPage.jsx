/**
 * SettingsPage — Wired to auditAPI + healthAPI
 *
 * GET /api/audit   → audit log
 * GET /api/health  → system health summary
 */
import { useState, useEffect } from 'react';
import { auditAPI, healthAPI } from '../services/api';

export default function SettingsPage() {
  const [logs, setLogs]         = useState([]);
  const [health, setHealth]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [auditRes, healthRes] = await Promise.all([
          auditAPI.getLogs({ limit: 50 }),
          healthAPI.services(),
        ]);
        const auditData = auditRes?.data ?? auditRes;
        setLogs(Array.isArray(auditData?.logs) ? auditData.logs : Array.isArray(auditData) ? auditData : []);
        setHealth(healthRes?.data ?? healthRes);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-mono font-bold text-sm tracking-widest uppercase" style={{ color: '#00F5FF' }}>System Settings</h1>

      {/* System health summary */}
      {health && (
        <div className="p-4 rounded-lg" style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)' }}>
          <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: '#6B7894' }}>System Health</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(health).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase" style={{ color: '#6B7894' }}>{key}:</span>
                <span className="font-mono text-xs" style={{ color: typeof val === 'boolean' ? (val ? '#00FF88' : '#FF3D71') : '#B8C4E0' }}>
                  {typeof val === 'boolean' ? (val ? 'OK' : 'FAIL') : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded text-xs font-mono"
          style={{ background: 'rgba(255,61,113,0.08)', border: '1px solid rgba(255,61,113,0.2)', color: '#FF3D71' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Audit log */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: '#6B7894' }}>Audit Log</p>
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(0,245,255,0.08)' }}>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ background: 'rgba(0,245,255,0.04)', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
                {['Time', 'Actor', 'Action', 'Target', 'Result'].map(h => (
                  <th key={h} className="px-4 py-3 text-left tracking-widest uppercase"
                    style={{ color: '#6B7894', fontSize: '10px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#3D4663' }}>No audit entries found.</td></tr>
              ) : logs.map((l, i) => (
                <tr key={l._id ?? i} style={{ borderBottom: '1px solid rgba(0,245,255,0.04)' }}
                  className="hover:bg-[rgba(0,245,255,0.02)] transition-colors">
                  <td className="px-4 py-3" style={{ color: '#6B7894' }}>
                    {l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{l.actor ?? l.user ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#00F5FF' }}>{l.action ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#B8C4E0' }}>{l.target ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span style={{ color: l.result === 'success' ? '#00FF88' : l.result === 'failure' ? '#FF3D71' : '#6B7894' }}>
                      {l.result ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
