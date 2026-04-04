/**
 * SENTINAL — Socket.io Singleton Client  (v3 — fixed export names)
 *
 * Exports:
 *   getSocket()       — returns singleton socket instance
 *   destroySocket()   — alias: disconnectSocket()
 *   disconnectSocket()— alias for backward compat
 *   SOCKET_EVENTS     — all real event names from backend/src/sockets/
 */
import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let _socket = null;

export function getSocket() {
  if (!_socket) {
    _socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      autoConnect: true,
    });
    _socket.on('connect',       () => console.info(`[SENTINAL] Socket connected: ${_socket.id}`));
    _socket.on('disconnect',    (r) => console.warn(`[SENTINAL] Socket disconnected: ${r}`));
    _socket.on('connect_error', (e) => console.error(`[SENTINAL] Socket error: ${e.message}`));
  }
  return _socket;
}

export function destroySocket() {
  if (_socket) { _socket.disconnect(); _socket = null; }
}

/** Alias kept for any page that imports disconnectSocket */
export const disconnectSocket = destroySocket;

export const SOCKET_EVENTS = {
  NEW_ATTACK:      'new_attack',
  ATTACK_RESOLVED: 'attack_resolved',
  IP_BLOCKED:      'ip_blocked',
  IP_UNBLOCKED:    'ip_unblocked',
  NEW_LOG:         'new_log',
  NEW_ALERT:       'new_alert',
  ALERT_READ:      'alert_read',
  STATS_UPDATE:    'stats_update',
  SERVICE_STATUS:  'service_status',
  NEXUS_DECISION:  'nexus_decision',
  ACTION_QUEUED:   'action_queued',
  ACTION_EXECUTED: 'action_executed',
};
