// backend/server/http/routes/docs/docs.route.ts
import type { FastifyInstance } from 'fastify';

const openApiDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Trading Agent Demo - Node.js Infrastructure',
    version: '0.1.0',
    description: 'Baseline health endpoints served from the Node.js infrastructure chapter.'
  },
  servers: [{ url: '/', description: 'Local server' }],
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Plain health probe',
        responses: {
          200: {
            description: 'Health payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    serverTimeUtc: { type: 'string', format: 'date-time' },
                    version: { type: 'string' }
                  },
                  required: ['ok', 'serverTimeUtc', 'version']
                }
              }
            }
          }
        }
      }
    },
    '/api/health': {
      get: {
        tags: ['health'],
        summary: 'API-prefixed health probe',
        responses: {
          200: {
            description: 'Health payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    serverTimeUtc: { type: 'string', format: 'date-time' },
                    version: { type: 'string' }
                  },
                  required: ['ok', 'serverTimeUtc', 'version']
                }
              }
            }
          }
        }
      }
    }
  },
  tags: [
    {
      name: 'health',
      description: 'Liveness and readiness probes'
    }
  ]
};

const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Trading Agent Demo API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.10/swagger-ui.css" />
    <style>
      body { margin: 0; padding: 0; }
      #swagger-ui { min-height: 100vh; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.10/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
        });
      };
    </script>
  </body>
</html>`;

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/openapi.json', async (_request, reply) => {
    reply.type('application/json').send(openApiDoc);
  });

  app.get('/api/docs', async (_request, reply) => {
    reply.type('text/html').send(swaggerHtml);
  });
}

export default docsRoutes;
