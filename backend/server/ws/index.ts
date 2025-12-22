// backend/server/ws/index.ts
import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type ServerOptions } from 'socket.io';
import { appConfig } from '../../config/index.js';

/**
 * Attaches Socket.IO to the Fastify HTTP server for live transport events.
 */
export const attachWebsocketServer = (app: FastifyInstance): SocketIOServer => {
  const options: Partial<ServerOptions> = {
    path: appConfig.ws.path,
    serveClient: false,
    cors: {
      origin: '*'
    }
  };

  const io = new SocketIOServer(app.server, options);

  io.on('connection', (socket) => {
    app.log.info({ socketId: socket.id }, 'ws connected');

    socket.on('disconnect', (reason) => {
      app.log.info({ socketId: socket.id, reason }, 'ws disconnected');
    });
  });

  return io;
};
