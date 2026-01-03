// backend/server/http/routes/docs/docs.route.ts
import type { FastifyInstance } from 'fastify';

const openApiDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Trading Agent Demo',
    version: '0.2.0',
    description: 'API-Endpoints.'
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
                    serverTimeUtc: { type: 'string', format: 'date-time' }
                  },
                  required: ['ok', 'serverTimeUtc']
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
                    serverTimeUtc: { type: 'string', format: 'date-time' }
                  },
                  required: ['ok', 'serverTimeUtc']
                }
              }
            }
          }
        }
      }
    },
    '/api/ui/layout': {
      get: {
        tags: ['ui'],
        summary: 'Get panel layout state',
        responses: {
          200: {
            description: 'Current UI layout',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    panels: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          visible: { type: 'boolean' },
                          collapsed: { type: 'boolean' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          w: { type: 'number' },
                          h: { type: 'number' }
                        },
                        required: ['visible', 'collapsed', 'x', 'y', 'w', 'h']
                      }
                    },
                    lastUpdatedUtc: { type: 'string', format: 'date-time', nullable: true }
                  },
                  required: ['panels', 'lastUpdatedUtc']
                },
                example: {
                  panels: {
                    health: {
                      visible: true,
                      collapsed: false,
                      x: 0,
                      y: 0,
                      w: 3,
                      h: 8
                    }
                  },
                  lastUpdatedUtc: null
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['ui'],
        summary: 'Replace panel layout state',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  panels: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        visible: { type: 'boolean' },
                        collapsed: { type: 'boolean' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        w: { type: 'number' },
                        h: { type: 'number' }
                      },
                      required: ['visible', 'collapsed', 'x', 'y', 'w', 'h']
                    }
                  }
                },
                required: ['panels']
              },
              example: {
                panels: {
                  health: {
                    visible: true,
                    collapsed: false,
                    x: 0,
                    y: 0,
                    w: 3,
                    h: 8
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated UI layout',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/paths/~1api~1ui~1layout/get/responses/200/content/application~1json/schema'
                },
                example: {
                  panels: {
                    health: {
                      visible: true,
                      collapsed: false,
                      x: 0,
                      y: 0,
                      w: 3,
                      h: 8
                    }
                  },
                  lastUpdatedUtc: null
                }
              }
            }
          }
        }
      },
      patch: {
        tags: ['ui'],
        summary: 'Upsert panel layout entries',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  panels: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        visible: { type: 'boolean' },
                        collapsed: { type: 'boolean' },
                        x: { type: 'number' },
                        y: { type: 'number' },
                        w: { type: 'number' },
                        h: { type: 'number' }
                      },
                      required: ['visible', 'collapsed', 'x', 'y', 'w', 'h']
                    }
                  }
                },
                required: ['panels']
              },
              example: {
                panels: {
                  health: {
                    visible: true,
                    collapsed: false,
                    x: 0,
                    y: 0,
                    w: 3,
                    h: 8
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated UI layout',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/paths/~1api~1ui~1layout/get/responses/200/content/application~1json/schema'
                },
                example: {
                  panels: {
                    health: {
                      visible: true,
                      collapsed: false,
                      x: 0,
                      y: 0,
                      w: 3,
                      h: 8
                    }
                  },
                  lastUpdatedUtc: null
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
    },
    {
      name: 'ui',
      description: 'Panel layout state'
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
