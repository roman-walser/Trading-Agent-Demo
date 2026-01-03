// backend/states/ui.state.ts
export type PanelLayout = {
  visible: boolean;
  collapsed: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type UiLayoutState = {
  panels: Record<string, PanelLayout>;
  lastUpdatedUtc: string | null;
};

const uiLayoutState: UiLayoutState = {
  panels: {},
  lastUpdatedUtc: null
};

const cloneLayout = (state: UiLayoutState): UiLayoutState => ({
  panels: { ...state.panels },
  lastUpdatedUtc: state.lastUpdatedUtc
});

/**
 * Replaces the entire UI layout state.
 */
export const setUiLayoutState = (next: UiLayoutState): UiLayoutState => {
  uiLayoutState.panels = { ...next.panels };
  uiLayoutState.lastUpdatedUtc = next.lastUpdatedUtc;
  return cloneLayout(uiLayoutState);
};

/**
 * Merges layout entries into the existing state (upsert).
 */
export const mergeUiLayout = (panels: Record<string, PanelLayout>, updatedAtUtc: string): UiLayoutState => {
  uiLayoutState.panels = { ...uiLayoutState.panels, ...panels };
  uiLayoutState.lastUpdatedUtc = updatedAtUtc;
  return cloneLayout(uiLayoutState);
};

/**
 * Returns a defensive copy of the UI layout state.
 */
export const getUiLayoutState = (): UiLayoutState => cloneLayout(uiLayoutState);
