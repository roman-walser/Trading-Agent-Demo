// frontend/api/routes/uiLayout.api.ts
import { deleteJson, getJson, postJson, patchJson, type RequestOptions } from '../httpClient.js';

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

export type UiLayoutHistoryDto = {
  snapshots: UiLayoutStateDto[];
};

export type UiLayoutHistoryClearDto = {
  snapshot: UiLayoutStateDto;
};

export type UiLayoutPresetDto = {
  id: string;
  name: string;
  snapshot: UiLayoutStateDto;
  createdUtc: string;
  updatedUtc: string;
};

export type UiLayoutPresetsDto = {
  layouts: UiLayoutPresetDto[];
};

export type UiLayoutPresetCreateDto = {
  name: string;
  snapshot: UiLayoutStateDto;
};

export type UiLayoutPresetRenameDto = {
  name: string;
};

export type UiLayoutPresetResponseDto = {
  preset: UiLayoutPresetDto;
};

export type UiLayoutPresetDeleteDto = {
  removed: UiLayoutPresetDto;
};

export const fetchUiLayout = async (
  options?: RequestOptions
): Promise<UiLayoutStateDto> => getJson<UiLayoutStateDto>('/api/ui/layout', options);

export const fetchUiLayoutHistory = async (
  limit?: number,
  options?: RequestOptions
): Promise<UiLayoutHistoryDto> => {
  const query = typeof limit === 'number' ? `?limit=${encodeURIComponent(limit)}` : '';
  return getJson<UiLayoutHistoryDto>(`/api/ui/layout/history${query}`, options);
};

export const clearUiLayoutHistory = async (
  options?: RequestOptions
): Promise<UiLayoutHistoryClearDto> =>
  deleteJson<UiLayoutHistoryClearDto>('/api/ui/layout/history', options);

export const fetchUiLayoutPresets = async (
  options?: RequestOptions
): Promise<UiLayoutPresetsDto> => getJson<UiLayoutPresetsDto>('/api/ui/layouts', options);

export const createUiLayoutPreset = async (
  payload: UiLayoutPresetCreateDto,
  options?: RequestOptions
): Promise<UiLayoutPresetResponseDto> =>
  postJson<UiLayoutPresetResponseDto>('/api/ui/layouts', payload, options);

export const renameUiLayoutPreset = async (
  id: string,
  payload: UiLayoutPresetRenameDto,
  options?: RequestOptions
): Promise<UiLayoutPresetResponseDto> =>
  patchJson<UiLayoutPresetResponseDto>(`/api/ui/layouts/${encodeURIComponent(id)}`, payload, options);

export const deleteUiLayoutPreset = async (
  id: string,
  options?: RequestOptions
): Promise<UiLayoutPresetDeleteDto> =>
  deleteJson<UiLayoutPresetDeleteDto>(`/api/ui/layouts/${encodeURIComponent(id)}`, options);

export const replaceUiLayout = async (
  payload: UiLayoutPayloadDto,
  options?: RequestOptions
): Promise<UiLayoutStateDto> =>
  postJson<UiLayoutStateDto>('/api/ui/layout', payload, options);

export const patchUiLayout = async (
  payload: UiLayoutPayloadDto,
  options?: RequestOptions
): Promise<UiLayoutStateDto> => patchJson<UiLayoutStateDto>('/api/ui/layout', payload, options);
