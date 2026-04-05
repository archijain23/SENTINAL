import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const http = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg  = err.response?.data?.message || err.message || 'Network error';
    const code = err.response?.data?.code    || err.code    || null;
    const error = new Error(msg);
    error.code  = code;
    error.status = err.response?.status || null;
    return Promise.reject(error);
  }
);

const unwrap = (res) => res.data?.data ?? res.data;

/* ─────────────────────────────────────────────────────────────
   FLAT EXPORTS
───────────────────────────────────────────────────────────── */

/* Stats */
export const getStats           = ()           => http.get('/api/stats').then(unwrap);

/* Attacks */
export const getRecentAttacks   = (limit = 50) => http.get(`/api/attacks/recent?limit=${limit}`).then(unwrap);
export const getAttack          = (id)         => http.get(`/api/attacks/${id}`).then(unwrap);
export const getForensics       = (id)         => http.get(`/api/attacks/${id}/forensics`).then(unwrap);

/* Alerts */
export const getAlerts          = (params = {}) => http.get('/api/alerts', { params }).then(unwrap);
export const markAlertRead      = (id)          => http.patch(`/api/alerts/${id}/read`).then(unwrap);
export const markAllAlertsRead  = ()            => http.patch('/api/alerts/read-all').then(unwrap);

/* Logs */
export const getRecentLogs      = (limit = 100) => http.get(`/api/logs/recent?limit=${limit}`).then(unwrap);

/* Services / Health */
export const getServiceStatus   = ()            => http.get('/api/service-status').then(unwrap);
export const getHealth          = ()            => http.get('/api/health').then(unwrap);

/* IP / Geo Intelligence */
export const getIpIntel         = (ip)          => http.get(`/api/geo/ip/${encodeURIComponent(ip)}`).then(unwrap);
export const getGeoHeatmap      = ()            => http.get('/api/geo/heatmap').then(unwrap);
export const getGeoStats        = ()            => http.get('/api/geo/stats').then(unwrap);
export const getGeoThreats      = ()            => http.get('/api/geo/threats').then(unwrap);
export const getTopSources      = ()            => http.get('/api/geo/top-sources').then(unwrap);

/* PCAP */
export const uploadPcap = (file, projectId = 'pcap-upload') => {
  const form = new FormData();
  form.append('pcap', file);
  form.append('projectId', projectId);
  return http.post('/api/pcap/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
  });
};
export const getPcapSessions    = (limit = 100) => http.get(`/api/pcap?limit=${limit}`).then(unwrap);
export const getPcapJobs        = (limit = 100) => http.get(`/api/pcap/jobs?limit=${limit}`).then(unwrap);
export const getPcapJob         = (id)          => http.get(`/api/pcap/jobs/${id}`).then(unwrap);

/* Blocklist */
export const getBlocklist       = ()            => http.get('/api/blocklist').then(unwrap);
export const checkBlockedIP     = (ip)          => http.get(`/api/blocklist/check/${encodeURIComponent(ip)}`).then(unwrap);
export const blockIP            = (payload)     => http.post('/api/blocklist', payload).then(unwrap);
export const unblockIP          = (ip)          => http.delete(`/api/blocklist/${encodeURIComponent(ip)}`).then(unwrap);

/* Action Queue / Nexus */
export const getPendingActions  = ()            => http.get('/api/actions/pending').then(unwrap);
export const approveAction      = (id)          => http.post(`/api/actions/${id}/approve`, { approvedBy: 'analyst' }).then(unwrap);
export const rejectAction       = (id)          => http.post(`/api/actions/${id}/reject`,  { rejectedBy: 'analyst' }).then(unwrap);
export const getActionHistory   = (limit = 50)  => http.get(`/api/actions/history?limit=${limit}`).then(unwrap);

/* Audit Log */
export const getAuditLog        = (limit = 100) => http.get(`/api/audit?limit=${limit}`).then(unwrap);

/* Simulation */
export const getSimulations     = ()            => http.get('/api/simulate').then(unwrap);
export const runSimulation      = (payload)     => http.post('/api/simulate', payload).then(unwrap);

/* Correlation */
export const getCorrelations    = ()            => http.get('/api/correlation').then(unwrap);

/* Settings */
export const getSettings        = ()            => http.get('/api/settings').then(unwrap);
export const updateSettings     = (partial)     => http.put('/api/settings', partial).then(unwrap);
export const testApiKey         = ()            => http.post('/api/settings/test-api-key').then(unwrap);

/* Gemini AI */
export const geminiChat = (message, history = []) =>
  http.post('/api/gemini/chat', { message, history }).then(unwrap);

export const geminiChatStream = (message, history = []) => {
  const params = new URLSearchParams({
    message,
    ...(history.length ? { history: JSON.stringify(history) } : {}),
  });
  return new EventSource(`${BASE}/api/gemini/chat/stream?${params}`);
};

export const geminiReport = (attackId, reportType = 'technical') =>
  http.post(`/api/gemini/report/${attackId}`, { reportType }).then(unwrap);

export const geminiReportExportUrl = (attackId, reportType = 'technical') =>
  `${BASE}/api/gemini/report/${attackId}/export?reportType=${reportType}`;

export const geminiCorrelate = () =>
  http.post('/api/gemini/correlate', {}, { timeout: 150_000 }).then(unwrap);

export const geminiCorrelateHistory = ()        => http.get('/api/gemini/correlate/history').then(unwrap);
export const geminiMutate = (payload, attackType = 'unknown') =>
  http.post('/api/gemini/mutate', { payload, attackType }, { timeout: 90_000 }).then(unwrap);

export const BASE_URL = BASE;

/* ─────────────────────────────────────────────────────────────
   NAMESPACE EXPORTS
───────────────────────────────────────────────────────────── */

export const statsAPI = {
  getSummary: getStats,
  get:        getStats,
};

export const attacksAPI = {
  getRecent:    getRecentAttacks,
  getById:      getAttack,
  getForensics: getForensics,
};

export const alertsAPI = {
  getAll:      (params) => getAlerts(params),
  markRead:    markAlertRead,
  markAllRead: markAllAlertsRead,
};

export const logsAPI = {
  getRecent: getRecentLogs,
};

export const healthAPI = {
  serviceStatus: getServiceStatus,
  get:           getHealth,
  services:      getServiceStatus,
};

export const ipAPI = {
  getIntel:      getIpIntel,
  getHeatmap:    getGeoHeatmap,
  getStats:      getGeoStats,
  getGeoThreats: getGeoThreats,
  getTopSources: getTopSources,
};

export const pcapAPI = {
  upload:      uploadPcap,
  getSessions: getPcapSessions,
  getJobs:     getPcapJobs,
  getJob:      getPcapJob,
};

export const blocklistAPI = {
  getAll:    getBlocklist,
  check:     checkBlockedIP,
  block:     blockIP,
  unblock:   unblockIP,
  addEntry:  blockIP,
  remove:    unblockIP,
};

export const nexusAPI = {
  getPending:  getPendingActions,
  approve:     approveAction,
  reject:      rejectAction,
  getHistory:  getActionHistory,
};

export const auditAPI = {
  getLog:  getAuditLog,
  getLogs: getAuditLog,
};

export const simulateAPI = {
  getAll:  getSimulations,
  run:     runSimulation,
  mutate:  geminiMutate,
};

export const correlationAPI = {
  getAll:      getCorrelations,
  run:         geminiCorrelate,
  getHistory:  geminiCorrelateHistory,
};

export const aiAPI = {
  chat:         geminiChat,
  chatStream:   geminiChatStream,
  report:       geminiReport,
  reportExport: geminiReportExportUrl,
  correlate:    geminiCorrelate,
  mutate:       geminiMutate,
};

export const settingsAPI = {
  get:        getSettings,
  update:     updateSettings,
  testApiKey: testApiKey,
};
