// backend/server/http/routes/ui/ui.schemas.ts
import type { UiLayoutState } from '../../../../states/ui.state.js';
import {
  panelLayoutSchema,
  uiLayoutPayloadSchema,
  uiLayoutPresetSchema,
  uiLayoutPresetCreateSchema,
  uiLayoutPresetRenameSchema,
  uiLayoutStateSchema,
  type PanelLayoutDto,
  type UiLayoutPayloadDto,
  type UiLayoutPresetDto,
  type UiLayoutPresetCreateDto,
  type UiLayoutPresetRenameDto,
  type UiLayoutStateDto
} from '../../../../state-services/ui.schema.js';

export {
  panelLayoutSchema,
  uiLayoutPayloadSchema,
  uiLayoutPresetSchema,
  uiLayoutPresetCreateSchema,
  uiLayoutPresetRenameSchema,
  uiLayoutStateSchema
};
export type {
  PanelLayoutDto,
  UiLayoutPayloadDto,
  UiLayoutPresetDto,
  UiLayoutPresetCreateDto,
  UiLayoutPresetRenameDto,
  UiLayoutStateDto
};

export const serializeUiLayout = (state: UiLayoutState): UiLayoutStateDto =>
  uiLayoutStateSchema.parse(state);

export const serializeUiLayoutPreset = (
  preset: UiLayoutPresetDto
): UiLayoutPresetDto => uiLayoutPresetSchema.parse(preset);
