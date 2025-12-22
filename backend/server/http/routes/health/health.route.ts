// backend/server/http/routes/health/health.route.ts
import type { FastifyInstance } from 'fastify';
import { appConfig } from '../../../../config/index.js';
import { healthResponseSchema, type HealthResponse } from './health.schemas.js';

const healthResponseJsonSchema = {
  200: {
    description: 'Health status',
    type: 'object',
    properties: {
      ok: { type: 'boolean', const: true },
      serverTimeUtc: { type: 'string' },
      version: { type: 'string' }
    },
    required: ['ok', 'serverTimeUtc', 'version']
  }
};

const formatUtcSeconds = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const buildHealth = (): HealthResponse =>
  healthResponseSchema.parse({
    ok: true,
    serverTimeUtc: formatUtcSeconds(new Date()),
    version: appConfig.meta.version
  });

/**
 * Registers health endpoints for transport reachability checks.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        response: healthResponseJsonSchema
      }
    },
    async () => buildHealth()
  );

  app.get(
    '/api/health',
    {
      schema: {
        response: healthResponseJsonSchema
      }
    },
    async () => buildHealth()
  );
}

export default healthRoutes;
