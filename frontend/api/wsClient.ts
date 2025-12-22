// frontend/api/wsClient.ts
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export const WS_PATH = import.meta.env.VITE_WS_PATH ?? '/ws';
export const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

const socket: Socket = io(WS_URL, {
  path: WS_PATH,
  transports: ['websocket']
});

export const useWsConnectionState = (): WsStatus => {
  const [status, setStatus] = useState<WsStatus>(socket.connected ? 'connected' : 'connecting');

  useEffect(() => {
    const handleConnect = (): void => setStatus('connected');
    const handleDisconnect = (): void => setStatus('disconnected');
    const handleReconnectAttempt = (): void => setStatus('connecting');
    const handleError = (): void => setStatus('disconnected');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('connect_error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('connect_error', handleError);
    };
  }, []);

  return status;
};

export { socket as wsClient };
