// backend/server/http/routes/ui/ui.schemas.ts
import { z } from 'zod';
import type { UiLayoutState } from '../../../../states/ui.state.js';

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

export type PanelLayoutDto = z.infer<typeof panelLayoutSchema>;
export type UiLayoutPayloadDto = z.infer<typeof uiLayoutPayloadSchema>;
export type UiLayoutStateDto = z.infer<typeof uiLayoutStateSchema>;

export const serializeUiLayout = (state: UiLayoutState): UiLayoutStateDto =>
  uiLayoutStateSchema.parse(state);
