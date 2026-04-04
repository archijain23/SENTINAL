/**
 * SENTINAL — Socket.io Singleton Client  (v2)
 *
 * All real socket events confirmed from:
 *   backend/src/sockets/
 *
 * Usage:
 *   import { getSocket, SOCKET_EVENTS } from './socket';
 *   const socket = getSocket();
 *   socket.on(SOCKET_EVENTS.NEW_ATTACK, handler);
 */
import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let _socket = null;

/**
 * Returns the singleton Socket.io instance.
 * Creates a new connection only on first call.
 */
export function getSocket() {
  if (!_socket) {
    _socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: true,
    });

    _socket.on('connect', () =>
      console.info(`[SENTINAL] Socket connected: ${_socket.id}`)
    );
    _socket.on('disconnect', (reason) =>
      console.warn(`[SENTINAL] Socket disconnected: ${reason}`)
    );
    _socket.on('connect_error', (err) =>
      console.error(`[SENTINAL] Socket error: ${err.message}`)
    );
  }
  return _socket;
}

/**
 * Disconnect and destroy the singleton.
 * Call on app unmount / logout.
 */
export function destroySocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/**
 * Real socket event names emitted by the SENTINAL backend.
 * Keep in sync with backend/src/sockets/
 */
export const SOCKET_EVENTS = {
  // Attack pipeline
  NEW_ATTACK:       'new_attack',
  ATTACK_RESOLVED:  'attack_resolved',
  // Blocklist mutations
  IP_BLOCKED:       'ip_blocked',
  IP_UNBLOCKED:     'ip_unblocked',
  // Live log stream
  NEW_LOG:          'new_log',
  // Alert notifications
  NEW_ALERT:        'new_alert',
  ALERT_READ:       'alert_read',
  // Dashboard stats push
  STATS_UPDATE:     'stats_update',
  // Service health push
  SERVICE_STATUS:   'service_status',
  // Nexus/AI decisions
  NEXUS_DECISION:   'nexus_decision',
  ACTION_QUEUED:    'action_queued',
  ACTION_EXECUTED:  'action_executed',
};
