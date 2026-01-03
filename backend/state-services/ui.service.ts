// backend/state-services/ui.service.ts
import { getUiLayoutState, mergeUiLayout, setUiLayoutState, type PanelLayout, type UiLayoutState } from '../states/ui.state.js';

export type UpsertUiLayoutPayload = {
  panels: Record<string, PanelLayout>;
};

const utcNow = (): string => new Date().toISOString();

/**
 * Returns a defensive snapshot of the current UI layout.
 */
export const getUiLayoutSnapshot = (): UiLayoutState => getUiLayoutState();

/**
 * Replaces the layout entirely.
 */
export const replaceUiLayout = (payload: UpsertUiLayoutPayload): UiLayoutState => {
  const updatedAtUtc = utcNow();
  return setUiLayoutState({
    panels: { ...payload.panels },
    lastUpdatedUtc: updatedAtUtc
  });
};

/**
 * Merges layout entries into the existing layout (idempotent per panel id).
 */
export const upsertUiLayout = (payload: UpsertUiLayoutPayload): UiLayoutState => {
  const updatedAtUtc = utcNow();
  return mergeUiLayout(payload.panels, updatedAtUtc);
};
