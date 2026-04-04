/**
 * SENTINAL — Centralized API Service Layer  (v2 — fully reconciled)
 *
 * Every endpoint in this file maps to a REAL route confirmed in:
 *   backend/src/routes/*.js
 *
 * Gateway base URL is read from VITE_API_URL env var.
 * Falls back to localhost:3000 for local dev.
 *
 * Route registry (verified):
 *   GET    /health
 *   GET    /api/health
 *   GET    /api/service-status
 *   GET    /api/stats
 *   GET    /api/attacks/recent
 *   GET    /api/attacks/search?q=
 *   GET    /api/attacks/search/stats
 *   POST   /api/attacks/report
 *   GET    /api/alerts
 *   PATCH  /api/alerts/:id/read
 *   GET    /api/logs
 *   GET    /api/blocklist
 *   GET    /api/blocklist/check/:ip
 *   POST   /api/blocklist
 *   DELETE /api/blocklist/:ip
 *   GET    /api/geo
 *   GET    /api/geo/heatmap
 *   GET    /api/geo/top-countries
 *   GET    /api/pcap
 *   GET    /api/pcap/:sessionId
 *   POST   /api/pcap/upload
 *   POST   /api/pcap/:sessionId/analyze
 *   GET    /api/nexus/status              (pending — route uses /trigger)
 *   POST   /api/nexus/trigger
 *   POST   /api/gemini/analyze
 *   POST   /api/gemini/explain
 *   POST   /api/gemini/threat-intel
 *   POST   /api/actions/block
 *   POST   /api/actions/whitelist
 *   GET    /api/actions/pending
 *   GET    /api/audit
 *   GET    /api/attacks/:id/forensics
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper
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

  if (res.status === 204) return null;
  return res.json();
}

const get   = (path, opts)       => request(path, { method: 'GET',    ...opts });
const post  = (path, body, opts) => request(path, { method: 'POST',   body: JSON.stringify(body), ...opts });
const patch = (path, body, opts) => request(path, { method: 'PATCH',  body: JSON.stringify(body), ...opts });
const del   = (path, opts)       => request(path, { method: 'DELETE', ...opts });

// ─────────────────────────────────────────────────────────────
// Health & Gateway
// ─────────────────────────────────────────────────────────────
export const healthAPI = {
  /** GET /health  →  { status, service, uptime, port } */
  ping:          ()  => get('/health'),
  /** GET /api/health  →  { status, services[] } */
  services:      ()  => get('/api/health'),
  /** GET /api/service-status  →  { services[] } */
  serviceStatus: ()  => get('/api/service-status'),
};

// ─────────────────────────────────────────────────────────────
// Stats  →  DashboardPage KPI cards
// ─────────────────────────────────────────────────────────────
export const statsAPI = {
  /** GET /api/stats  →  { totalAttacks, blockedIPs, activeAlerts, uptime } */
  getSummary: () => get('/api/stats'),
};

// ─────────────────────────────────────────────────────────────
// Attacks  →  ThreatsPage + DashboardPage
// Real routes: GET /recent  |  GET /search  |  POST /report
// ─────────────────────────────────────────────────────────────
export const attacksAPI = {
  /** GET /api/attacks/recent?limit=&page=  →  { data[], count } */
  getRecent:    (params = {}) => get(`/api/attacks/recent?${new URLSearchParams(params)}`),
  /** GET /api/attacks/search?q=<term>  →  { data[], count } */
  search:       (q, params = {}) => get(`/api/attacks/search?q=${encodeURIComponent(q)}&${new URLSearchParams(params)}`),
  /** GET /api/attacks/search/stats  →  aggregated chart data */
  searchStats:  () => get('/api/attacks/search/stats'),
  /** POST /api/attacks/report  →  report a new attack (used by detection engine) */
  report:       (payload) => post('/api/attacks/report', payload),
  /** GET /api/attacks/:id/forensics  →  forensic detail */
  forensics:    (id)      => get(`/api/attacks/${id}/forensics`),
};

// ─────────────────────────────────────────────────────────────
// Logs  →  DashboardPage live feed + LogsPage
// ─────────────────────────────────────────────────────────────
export const logsAPI = {
  /** GET /api/logs?limit=&page=&level= */
  getRecent: (params = {}) => get(`/api/logs?${new URLSearchParams(params)}`),
};

// ─────────────────────────────────────────────────────────────
// Alerts  →  DashboardPage alert panel
// ─────────────────────────────────────────────────────────────
export const alertsAPI = {
  /** GET /api/alerts?status=&severity= */
  getAll:   (params = {}) => get(`/api/alerts?${new URLSearchParams(params)}`),
  /** PATCH /api/alerts/:id/read */
  markRead: (id)          => patch(`/api/alerts/${id}/read`),
};

// ─────────────────────────────────────────────────────────────
// Blocklist  →  BlocklistPage
// Real routes: GET /  |  GET /check/:ip  |  POST /  |  DELETE /:ip
// ─────────────────────────────────────────────────────────────
export const blocklistAPI = {
  /** GET /api/blocklist  →  { data[], count } */
  getAll:   (params = {}) => get(`/api/blocklist?${new URLSearchParams(params)}`),
  /** GET /api/blocklist/check/:ip  →  { blocked: bool, data } */
  checkIP:  (ip)          => get(`/api/blocklist/check/${encodeURIComponent(ip)}`),
  /** POST /api/blocklist  →  block an IP */
  addEntry: (entry)       => post('/api/blocklist', entry),
  /** DELETE /api/blocklist/:ip  →  unblock */
  remove:   (ip)          => del(`/api/blocklist/${encodeURIComponent(ip)}`),
};

// ─────────────────────────────────────────────────────────────
// GeoIntel  →  DashboardPage threat map
// ─────────────────────────────────────────────────────────────
export const geoAPI = {
  /** GET /api/geo?limit= */
  getThreats:     (params = {}) => get(`/api/geo?${new URLSearchParams(params)}`),
  /** GET /api/geo/heatmap  →  { cells[] } */
  getHeatmap:     ()            => get('/api/geo/heatmap'),
  /** GET /api/geo/top-countries  →  { countries[] } */
  getTopCountries: ()           => get('/api/geo/top-countries'),
};

// ─────────────────────────────────────────────────────────────
// PCAP  →  PcapPage
// Real routes: GET /  |  GET /:sessionId  |  POST /upload  |  POST /:sessionId/analyze
// ─────────────────────────────────────────────────────────────
export const pcapAPI = {
  /** GET /api/pcap?page=&limit=  →  { sessions[] } */
  getSessions:  (params = {}) => get(`/api/pcap?${new URLSearchParams(params)}`),
  /** GET /api/pcap/:sessionId  →  session detail */
  getSession:   (sessionId)   => get(`/api/pcap/${sessionId}`),
  /** POST /api/pcap/upload  →  upload a .pcap file (use FormData, not JSON) */
  upload:       (formData)    => request('/api/pcap/upload', {
    method: 'POST',
    body: formData,
    headers: {},               // let browser set multipart boundary
  }),
  /** POST /api/pcap/:sessionId/analyze  →  trigger ML analysis */
  analyze:      (sessionId, payload = {}) => post(`/api/pcap/${sessionId}/analyze`, payload),
};

// ─────────────────────────────────────────────────────────────
// Nexus AI  →  NexusPage
// Real route: POST /api/nexus/trigger
// Note: /api/nexus/analyze was renamed to /trigger in the backend
// ─────────────────────────────────────────────────────────────
export const nexusAPI = {
  /** POST /api/nexus/trigger  →  simulate + enforce an attack event */
  trigger:  (payload) => post('/api/nexus/trigger', payload),
  /**
   * Alias for backward compat — pages calling nexusAPI.analyze() still work.
   * Internally maps to the real /trigger route.
   */
  analyze:  (payload) => post('/api/nexus/trigger', payload),
};

// ─────────────────────────────────────────────────────────────
// Gemini AI  →  NexusPage / Threat insight panel
// Real routes: POST /analyze  |  POST /explain  |  POST /threat-intel
// ─────────────────────────────────────────────────────────────
export const geminiAPI = {
  /** POST /api/gemini/analyze  →  AI threat analysis */
  analyze:      (payload) => post('/api/gemini/analyze', payload),
  /** POST /api/gemini/explain  →  explain attack forensics in plain language */
  explain:      (payload) => post('/api/gemini/explain', payload),
  /** POST /api/gemini/threat-intel  →  enrich IP/domain with threat intel */
  threatIntel:  (payload) => post('/api/gemini/threat-intel', payload),
};

// ─────────────────────────────────────────────────────────────
// Actions  →  ThreatsPage action buttons
// Real routes: POST /block  |  POST /whitelist  |  GET /pending
// ─────────────────────────────────────────────────────────────
export const actionsAPI = {
  /** POST /api/actions/block      → { success, message } */
  blockIP:      (ip, meta = {}) => post('/api/actions/block',     { ip, ...meta }),
  /** POST /api/actions/whitelist  → { success, message } */
  whitelistIP:  (ip, meta = {}) => post('/api/actions/whitelist', { ip, ...meta }),
  /** GET  /api/actions/pending    → pending human-approval actions queue */
  getPending:   ()              => get('/api/actions/pending'),
};

// ─────────────────────────────────────────────────────────────
// Audit  →  SettingsPage audit log
// ─────────────────────────────────────────────────────────────
export const auditAPI = {
  /** GET /api/audit?page=&limit=&action= */
  getLogs: (params = {}) => get(`/api/audit?${new URLSearchParams(params)}`),
};

// ─────────────────────────────────────────────────────────────
// Export base URL for Socket.io connection
// ─────────────────────────────────────────────────────────────
export { BASE_URL };
