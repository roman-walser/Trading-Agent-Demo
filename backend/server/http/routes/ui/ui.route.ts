// backend/server/http/routes/ui/ui.route.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  clearUiLayoutHistory,
  createUiLayoutPreset,
  deleteUiLayoutPresetById,
  getUiLayoutHistory,
  getUiLayoutPresets,
  getUiLayoutSnapshot,
  renameUiLayoutPresetById,
  replaceUiLayout,
  upsertUiLayout
} from '../../../../state-services/ui.service.js';
import {
  panelLayoutSchema,
  serializeUiLayout,
  serializeUiLayoutPreset,
  uiLayoutPayloadSchema,
  uiLayoutPresetCreateSchema,
  uiLayoutPresetRenameSchema,
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

const uiLayoutStateJsonSchema = {
  type: 'object',
  properties: {
    panels: {
      type: 'object',
      additionalProperties: panelLayoutJsonSchema()
    },
    lastUpdatedUtc: { type: ['string', 'null'] }
  },
  required: ['panels', 'lastUpdatedUtc']
};

const uiLayoutResponseSchema = {
  200: {
    description: 'Current UI layout',
    ...uiLayoutStateJsonSchema
  }
};

const uiLayoutHistoryResponseSchema = {
  200: {
    description: 'UI layout history',
    type: 'object',
    properties: {
      snapshots: {
        type: 'array',
        items: uiLayoutStateJsonSchema
      }
    },
    required: ['snapshots']
  }
};

const uiLayoutHistoryClearResponseSchema = {
  200: {
    description: 'UI layout history cleared',
    type: 'object',
    properties: {
      snapshot: uiLayoutStateJsonSchema
    },
    required: ['snapshot']
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

const uiLayoutPresetJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    snapshot: uiLayoutStateJsonSchema,
    createdUtc: { type: 'string' },
    updatedUtc: { type: 'string' }
  },
  required: ['id', 'name', 'snapshot', 'createdUtc', 'updatedUtc']
};

const uiLayoutPresetsResponseSchema = {
  200: {
    description: 'Saved UI layouts',
    type: 'object',
    properties: {
      layouts: {
        type: 'array',
        items: uiLayoutPresetJsonSchema
      }
    },
    required: ['layouts']
  }
};

const uiLayoutPresetResponseSchema = {
  200: {
    description: 'UI layout preset',
    type: 'object',
    properties: {
      preset: uiLayoutPresetJsonSchema
    },
    required: ['preset']
  }
};

const uiLayoutPresetDeleteResponseSchema = {
  200: {
    description: 'UI layout preset deleted',
    type: 'object',
    properties: {
      removed: uiLayoutPresetJsonSchema
    },
    required: ['removed']
  }
};

const uiLayoutPresetCreateRequestSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      snapshot: uiLayoutStateJsonSchema
    },
    required: ['name', 'snapshot']
  }
};

const uiLayoutPresetRenameRequestSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  }
};

const uiLayoutPresetParamsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' }
  },
  required: ['id']
};

const uiLayoutHistoryQuerySchema = z.object({
  limit: z.preprocess(
    (value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed.length) return undefined;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    },
    z.number().int().positive().max(100).optional()
  )
});

const uiLayoutHistoryQueryJsonSchema = {
  type: 'object',
  properties: {
    limit: { type: 'string' }
  },
  additionalProperties: false
};

const uiLayoutPresetIdSchema = z.object({
  id: z.string().min(1)
});

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

  app.get(
    '/api/ui/layout/history',
    {
      schema: {
        querystring: uiLayoutHistoryQueryJsonSchema,
        response: uiLayoutHistoryResponseSchema
      }
    },
    async (request) => {
      const { limit } = uiLayoutHistoryQuerySchema.parse(request.query ?? {});
      const snapshots = await getUiLayoutHistory(limit);
      return {
        snapshots: snapshots.map((snapshot) => serializeUiLayout(snapshot))
      };
    }
  );

  app.delete(
    '/api/ui/layout/history',
    {
      schema: {
        response: uiLayoutHistoryClearResponseSchema
      }
    },
    async () => {
      const snapshot = await clearUiLayoutHistory();
      return { snapshot: serializeUiLayout(snapshot) };
    }
  );

  app.get(
    '/api/ui/layouts',
    {
      schema: {
        response: uiLayoutPresetsResponseSchema
      }
    },
    async () => {
      const presets = await getUiLayoutPresets();
      return { layouts: presets.map((preset) => serializeUiLayoutPreset(preset)) };
    }
  );

  app.post(
    '/api/ui/layouts',
    {
      schema: {
        body: uiLayoutPresetCreateRequestSchema.body,
        response: uiLayoutPresetResponseSchema
      }
    },
    async (request, reply) => {
      const parsed = uiLayoutPresetCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: 'Invalid layout preset payload.' });
      }

      const result = await createUiLayoutPreset(parsed.data.name, parsed.data.snapshot);
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          return reply.status(409).send({ message: 'Layout preset name already exists.' });
        }
        return reply.status(500).send({ message: 'Failed to save layout preset.' });
      }

      return { preset: serializeUiLayoutPreset(result.preset) };
    }
  );

  app.patch(
    '/api/ui/layouts/:id',
    {
      schema: {
        params: uiLayoutPresetParamsSchema,
        body: uiLayoutPresetRenameRequestSchema.body,
        response: uiLayoutPresetResponseSchema
      }
    },
    async (request, reply) => {
      const params = uiLayoutPresetIdSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ message: 'Invalid layout preset id.' });
      }

      const parsed = uiLayoutPresetRenameSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ message: 'Invalid layout preset name.' });
      }

      const result = await renameUiLayoutPresetById(params.data.id, parsed.data.name);
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return reply.status(404).send({ message: 'Layout preset not found.' });
        }
        if (result.reason === 'duplicate') {
          return reply.status(409).send({ message: 'Layout preset name already exists.' });
        }
        return reply.status(500).send({ message: 'Failed to rename layout preset.' });
      }

      return { preset: serializeUiLayoutPreset(result.preset) };
    }
  );

  app.delete(
    '/api/ui/layouts/:id',
    {
      schema: {
        params: uiLayoutPresetParamsSchema,
        response: uiLayoutPresetDeleteResponseSchema
      }
    },
    async (request, reply) => {
      const params = uiLayoutPresetIdSchema.safeParse(request.params ?? {});
      if (!params.success) {
        return reply.status(400).send({ message: 'Invalid layout preset id.' });
      }

      const result = await deleteUiLayoutPresetById(params.data.id);
      if (!result.ok) {
        if (result.reason === 'not_found') {
          return reply.status(404).send({ message: 'Layout preset not found.' });
        }
        return reply.status(500).send({ message: 'Failed to delete layout preset.' });
      }

      return { removed: serializeUiLayoutPreset(result.preset) };
    }
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
      return serializeUiLayout(await replaceUiLayout(payload));
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
      return serializeUiLayout(await upsertUiLayout(payload));
    }
  );
}

export default uiLayoutRoutes;
