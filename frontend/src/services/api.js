/**
 * SENTINAL — Centralized API Service Layer
 *
 * Single source of truth for all frontend ↔ backend communication.
 * Every page uses this file — never raw fetch() calls in components.
 *
 * Gateway base URL is read from VITE_API_URL env var.
 * Falls back to localhost:3000 for local dev.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper — handles JSON, errors, and base URL
// ─────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  const res = await fetch(url, config);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  // 204 No Content — return null
  if (res.status === 204) return null;

  return res.json();
}

// ─────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────
const get    = (path, opts)        => request(path, { method: 'GET',    ...opts });
const post   = (path, body, opts)  => request(path, { method: 'POST',   body: JSON.stringify(body), ...opts });
const put    = (path, body, opts)  => request(path, { method: 'PUT',    body: JSON.stringify(body), ...opts });
const patch  = (path, body, opts)  => request(path, { method: 'PATCH',  body: JSON.stringify(body), ...opts });
const del    = (path, opts)        => request(path, { method: 'DELETE', ...opts });

// ─────────────────────────────────────────────────────────────
// Health & Gateway
// GET /health  →  { status, service, uptime, port }
// ─────────────────────────────────────────────────────────────
export const healthAPI = {
  ping:           ()           => get('/health'),
  services:       ()           => get('/api/health'),
  serviceStatus:  ()           => get('/api/service-status'),
};

// ─────────────────────────────────────────────────────────────
// Stats  →  DashboardPage KPI cards
// GET /api/stats
// ─────────────────────────────────────────────────────────────
export const statsAPI = {
  getSummary: () => get('/api/stats'),
};

// ─────────────────────────────────────────────────────────────
// Attacks  →  DashboardPage charts + ThreatsPage table
// GET  /api/attacks
// GET  /api/attacks/:id
// POST /api/attacks/:id/resolve
// ─────────────────────────────────────────────────────────────
export const attacksAPI = {
  getAll:    (params = {})  => get(`/api/attacks?${new URLSearchParams(params)}`),
  getById:   (id)           => get(`/api/attacks/${id}`),
  resolve:   (id)           => post(`/api/attacks/${id}/resolve`),
};

// ─────────────────────────────────────────────────────────────
// Logs  →  LogsPage / DashboardPage live feed
// GET /api/logs
// ─────────────────────────────────────────────────────────────
export const logsAPI = {
  getRecent: (params = {}) => get(`/api/logs?${new URLSearchParams(params)}`),
};

// ─────────────────────────────────────────────────────────────
// Alerts  →  DashboardPage alert panel
// GET   /api/alerts
// PATCH /api/alerts/:id/read
// ─────────────────────────────────────────────────────────────
export const alertsAPI = {
  getAll:  (params = {}) => get(`/api/alerts?${new URLSearchParams(params)}`),
  markRead: (id)         => patch(`/api/alerts/${id}/read`),
};

// ─────────────────────────────────────────────────────────────
// Blocklist  →  BlocklistPage
// GET    /api/blocklist
// POST   /api/blocklist
// DELETE /api/blocklist/:id
// ─────────────────────────────────────────────────────────────
export const blocklistAPI = {
  getAll:  (params = {}) => get(`/api/blocklist?${new URLSearchParams(params)}`),
  addEntry: (entry)      => post('/api/blocklist', entry),
  remove:   (id)         => del(`/api/blocklist/${id}`),
};

// ─────────────────────────────────────────────────────────────
// GeoIntel  →  DashboardPage threat map
// GET /api/geo
// ─────────────────────────────────────────────────────────────
export const geoAPI = {
  getThreats: (params = {}) => get(`/api/geo?${new URLSearchParams(params)}`),
};

// ─────────────────────────────────────────────────────────────
// PCAP  →  PcapPage
// GET  /api/pcap
// POST /api/pcap/analyze
// ─────────────────────────────────────────────────────────────
export const pcapAPI = {
  getSessions: (params = {}) => get(`/api/pcap?${new URLSearchParams(params)}`),
  analyze:     (payload)     => post('/api/pcap/analyze', payload),
};

// ─────────────────────────────────────────────────────────────
// Nexus AI  →  NexusPage
// GET  /api/nexus/status
// POST /api/nexus/analyze
// ─────────────────────────────────────────────────────────────
export const nexusAPI = {
  getStatus:  ()        => get('/api/nexus/status'),
  analyze:    (payload) => post('/api/nexus/analyze', payload),
};

// ─────────────────────────────────────────────────────────────
// Gemini AI  →  NexusPage / Threat insight panel
// POST /api/gemini/analyze
// POST /api/gemini/explain
// ─────────────────────────────────────────────────────────────
export const geminiAPI = {
  analyze: (payload) => post('/api/gemini/analyze', payload),
  explain: (payload) => post('/api/gemini/explain', payload),
};

// ─────────────────────────────────────────────────────────────
// Actions  →  ThreatsPage action buttons
// POST /api/actions/block
// POST /api/actions/whitelist
// ─────────────────────────────────────────────────────────────
export const actionsAPI = {
  blockIP:     (ip)   => post('/api/actions/block',     { ip }),
  whitelistIP: (ip)   => post('/api/actions/whitelist', { ip }),
};

// ─────────────────────────────────────────────────────────────
// Audit  →  SettingsPage audit log
// GET /api/audit
// ─────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs: (params = {}) => get(`/api/audit?${new URLSearchParams(params)}`),
};

// ─────────────────────────────────────────────────────────────
// Forensics  →  ThreatsPage detail drawer
// GET /api/attacks/:id/forensics
// ─────────────────────────────────────────────────────────────
export const forensicsAPI = {
  getForAttack: (id) => get(`/api/attacks/${id}/forensics`),
};

// ─────────────────────────────────────────────────────────────
// Export base URL for Socket.io connection
// ─────────────────────────────────────────────────────────────
export { BASE_URL };
