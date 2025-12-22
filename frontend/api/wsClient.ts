// frontend/api/wsClient.ts
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export const WS_PATH = import.meta.env.VITE_WS_PATH ?? '/ws';
export const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;
let activeSubscribers = 0;

const getSocket = (): Socket => {
  if (!socket) {
    socket = io(WS_URL, {
      path: WS_PATH,
      transports: ['websocket'],
      autoConnect: false
    });
  }
  return socket;
};

const connectIfNeeded = (): void => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
};

const disconnectIfIdle = (): void => {
  if (socket && activeSubscribers <= 0) {
    socket.disconnect();
  }
};

export const useWsConnectionState = (): WsStatus => {
  const s = getSocket();
  const [status, setStatus] = useState<WsStatus>(s.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    activeSubscribers += 1;
    connectIfNeeded();

    const handleConnect = (): void => setStatus('connected');
    const handleDisconnect = (): void => setStatus('disconnected');
    const handleReconnectAttempt = (): void => setStatus('connecting');
    const handleError = (): void => setStatus('disconnected');

    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.io.on('reconnect_attempt', handleReconnectAttempt);
    s.on('connect_error', handleError);

    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.io.off('reconnect_attempt', handleReconnectAttempt);
      s.off('connect_error', handleError);
      activeSubscribers = Math.max(0, activeSubscribers - 1);
      if (activeSubscribers === 0) {
        disconnectIfIdle();
      }
    };
  }, [s]);

  return status;
};

export { getSocket as wsClient };
