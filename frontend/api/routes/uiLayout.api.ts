// frontend/api/routes/uiLayout.api.ts
import { getJson, postJson, patchJson, type RequestOptions } from '../httpClient.js';

export type PanelLayoutDto = {
  visible: boolean;
  collapsed: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type UiLayoutStateDto = {
  panels: Record<string, PanelLayoutDto>;
  lastUpdatedUtc: string | null;
};

export type UiLayoutPayloadDto = {
  panels: Record<string, PanelLayoutDto>;
};

export const fetchUiLayout = async (
  options?: RequestOptions
): Promise<UiLayoutStateDto> => getJson<UiLayoutStateDto>('/api/ui/layout', options);

export const replaceUiLayout = async (
  payload: UiLayoutPayloadDto,
  options?: RequestOptions
): Promise<UiLayoutStateDto> =>
  postJson<UiLayoutStateDto>('/api/ui/layout', payload, options);

export const patchUiLayout = async (
  payload: UiLayoutPayloadDto,
  options?: RequestOptions
): Promise<UiLayoutStateDto> => patchJson<UiLayoutStateDto>('/api/ui/layout', payload, options);
