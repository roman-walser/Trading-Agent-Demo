// backend/server/http/routes/ui/ui.route.ts
import type { FastifyInstance } from 'fastify';
import {
  getUiLayoutSnapshot,
  replaceUiLayout,
  upsertUiLayout
} from '../../../../state-services/ui.service.js';
import {
  panelLayoutSchema,
  serializeUiLayout,
  uiLayoutPayloadSchema,
  uiLayoutStateSchema
} from './ui.schemas.js';

const panelLayoutJsonSchema = () => ({
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
});

const uiLayoutResponseSchema = {
  200: {
    description: 'Current UI layout',
    type: 'object',
    properties: {
      panels: {
        type: 'object',
        additionalProperties: panelLayoutJsonSchema()
      },
      lastUpdatedUtc: { type: ['string', 'null'] }
    },
    required: ['panels', 'lastUpdatedUtc']
  }
};

const uiLayoutRequestSchema = {
  body: {
    type: 'object',
    properties: {
      panels: {
        type: 'object',
        additionalProperties: panelLayoutJsonSchema()
      }
    },
    required: ['panels']
  }
};

/**
 * Registers UI layout routes for getting and updating panel layout state.
 */
export async function uiLayoutRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/ui/layout',
    {
      schema: {
        response: uiLayoutResponseSchema
      }
    },
    async () => serializeUiLayout(getUiLayoutSnapshot())
  );

  app.post(
    '/api/ui/layout',
    {
      schema: {
        body: uiLayoutRequestSchema.body,
        response: uiLayoutResponseSchema
      }
    },
    async (request) => {
      const payload = uiLayoutPayloadSchema.parse(request.body);
      return serializeUiLayout(replaceUiLayout(payload));
    }
  );

  app.patch(
    '/api/ui/layout',
    {
      schema: {
        body: uiLayoutRequestSchema.body,
        response: uiLayoutResponseSchema
      }
    },
    async (request) => {
      const payload = uiLayoutPayloadSchema.parse(request.body);
      return serializeUiLayout(upsertUiLayout(payload));
    }
  );
}

export default uiLayoutRoutes;
