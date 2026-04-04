import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Named socket event constants ────────────────────────────────────────────
export const SOCKET_EVENTS = {
  // Stats / KPIs
  STATS_UPDATE:      'stats:update',
  // Attacks / Threats
  NEW_ATTACK:        'attack:new',
  ATTACK_UPDATE:     'attack:update',
  // Alerts
  NEW_ALERT:         'alert:new',
  ALERT_RESOLVED:    'alert:resolved',
  // Logs
  NEW_LOG:           'log:new',
  // Action queue
  QUEUE_UPDATE:      'queue:update',
  ACTION_DECISION:   'action:decision',
  // System health
  HEALTH_UPDATE:     'health:update',
  SERVICE_STATUS:    'service:status',
  // Geo / IP intel
  GEO_EVENT:         'geo:event',
  // Correlation
  CORRELATION_SCORE: 'correlation:score',
};

// ── Singleton socket instance ────────────────────────────────────────────────
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export default getSocket;
