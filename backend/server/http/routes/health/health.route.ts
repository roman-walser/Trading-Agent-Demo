// backend/server/http/routes/health/health.route.ts
import type { FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from './health.schemas.js';
import { refreshHealthState } from '../../../../state-services/health.service.js';

const healthResponseJsonSchema = {
  200: {
    description: 'Health status',
    type: 'object',
    properties: {
      ok: { type: 'boolean', const: true },
      serverTimeUtc: { type: 'string' }
    },
    required: ['ok', 'serverTimeUtc']
  }
};

const buildHealth = (): HealthResponse => {
  const snapshot = refreshHealthState();
  return healthResponseSchema.parse({
    ok: snapshot.ok,
    serverTimeUtc: snapshot.serverTimeUtc
  });
};

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
