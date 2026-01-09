// backend/state-services/ui.schema.ts
import { z } from 'zod';

export const panelLayoutSchema = z.object({
  visible: z.boolean(),
  collapsed: z.boolean(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
});

export const uiLayoutPayloadSchema = z.object({
  panels: z.record(panelLayoutSchema)
});

export const uiLayoutStateSchema = z.object({
  panels: z.record(panelLayoutSchema),
  lastUpdatedUtc: z.string().nullable()
});

export const uiLayoutPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  snapshot: uiLayoutStateSchema,
  createdUtc: z.string().min(1),
  updatedUtc: z.string().min(1)
});

export const uiLayoutPresetCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  snapshot: uiLayoutStateSchema
});

export const uiLayoutPresetRenameSchema = z.object({
  name: z.string().trim().min(1).max(64)
});

export type PanelLayoutDto = z.infer<typeof panelLayoutSchema>;
export type UiLayoutPayloadDto = z.infer<typeof uiLayoutPayloadSchema>;
export type UiLayoutStateDto = z.infer<typeof uiLayoutStateSchema>;
export type UiLayoutPresetDto = z.infer<typeof uiLayoutPresetSchema>;
export type UiLayoutPresetCreateDto = z.infer<typeof uiLayoutPresetCreateSchema>;
export type UiLayoutPresetRenameDto = z.infer<typeof uiLayoutPresetRenameSchema>;
