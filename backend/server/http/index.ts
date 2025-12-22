// backend/server/http/index.ts
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { appConfig } from '../../config/index.js';
import healthRoutes from './routes/health/health.route.js';

export const createHttpServer = (): FastifyInstance => {
  /**
   * Builds the Fastify HTTP server with baseline routes and logging configuration.
   */
  const app = Fastify({
    logger: {
      level: appConfig.logging.level
    }
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const frontendDistPath = path.resolve(__dirname, '../../../dist/frontend');
  const frontendAssetsPath = path.join(frontendDistPath, 'assets');

  app.register(fastifyStatic, {
    root: frontendAssetsPath,
    prefix: '/assets/'
  });

  app.register(healthRoutes);

  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.type('text/html').sendFile('index.html', frontendDistPath)
  );

  app.get('/vite.svg', async (_request: FastifyRequest, reply: FastifyReply) => {
    const svgPath = path.join(frontendDistPath, 'vite.svg');
    const svgContent = await readFile(svgPath, 'utf-8').catch(() => null);
    if (svgContent) {
      return reply.type('image/svg+xml').send(svgContent);
    }
    return reply.callNotFound();
  });

  app.get('/*', async (request: FastifyRequest, reply: FastifyReply) => {
    const isApi = request.url.startsWith('/api');
    const isWs = request.url.startsWith(appConfig.ws.path);
    const isAsset = request.url.startsWith('/assets/');

    if (isApi || isWs || isAsset) {
      return reply.callNotFound();
    }

    return reply.type('text/html').sendFile('index.html', frontendDistPath);
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`
    });
  });

  return app;
};
