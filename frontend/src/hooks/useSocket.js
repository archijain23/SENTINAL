import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';

export function useSocket(eventMap = {}) {
  const socketRef = useRef(null);
  const eventMapRef = useRef(eventMap);
  useEffect(() => { eventMapRef.current = eventMap; });

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    const handlers = Object.entries(eventMapRef.current);
    handlers.forEach(([event, handler]) => socket.on(event, handler));

    return () => {
      handlers.forEach(([event, handler]) => socket.off(event, handler));
      disconnectSocket();
    };
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit, socket: socketRef.current };
}
