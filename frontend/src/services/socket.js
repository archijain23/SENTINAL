/**
 * SENTINAL — Socket.io Client
 *
 * Manages the real-time WebSocket connection to the Gateway.
 * Used by DashboardPage for live attack feed and alert streaming.
 */

import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let socket = null;

/**
 * Get (or lazily create) the singleton Socket.io client.
 * Call this once inside a useEffect — don't create multiple instances.
 */
export function getSocket() {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    socket.on('connect',          () => console.info('[SOCKET] Connected:', socket.id));
    socket.on('disconnect', reason => console.warn('[SOCKET] Disconnected:', reason));
    socket.on('connect_error', err  => console.error('[SOCKET] Error:', err.message));
  }
  return socket;
}

/**
 * Cleanly disconnect — call in component cleanup (useEffect return fn).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Socket event name constants — avoids raw string typos across components
export const SOCKET_EVENTS = {
  NEW_ATTACK:     'new_attack',
  NEW_ALERT:      'new_alert',
  NEW_LOG:        'new_log',
  STATS_UPDATE:   'stats_update',
  SERVICE_STATUS: 'service_status',
};
