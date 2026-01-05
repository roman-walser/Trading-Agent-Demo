// frontend/state/uiLayout.slice.ts
import type { StoreAction, StoreApi } from './store.js';
import type { PanelLayoutDto, UiLayoutStateDto } from '../api/routes/uiLayout.api.js';

const LAYOUT_STORAGE_KEY = 'ui-layout-cache';

const toDto = (state: UiLayoutSliceState): UiLayoutStateDto => ({
  panels: state.panels,
  lastUpdatedUtc: state.lastUpdatedUtc
});

const readLayoutCache = (): UiLayoutStateDto | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UiLayoutStateDto;
    if (!parsed.panels) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLayoutCache = (state: UiLayoutSliceState): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(toDto(state)));
  } catch {
    /* ignore cache write failures */
  }
};

export type UiLayoutSliceState = {
  panels: Record<string, PanelLayoutDto>;
  lastUpdatedUtc: string | null;
  hydrated: boolean;
  hydrationSource: 'cache' | 'server' | null;
};

const HYDRATE = 'uiLayout/hydrate';
const UPDATE_PANEL = 'uiLayout/updatePanel';

const initialPanels: Record<string, PanelLayoutDto> = {
  health: { visible: true, collapsed: false, x: 0, y: 0, w: 3, h: 8 }
};

const initialState: UiLayoutSliceState = {
  panels: { ...initialPanels },
  lastUpdatedUtc: null,
  hydrated: false,
  hydrationSource: null
};

const reducer = (
  state: UiLayoutSliceState = initialState,
  action: StoreAction
): UiLayoutSliceState => {
  switch (action.type) {
    case HYDRATE: {
      const rawPayload = action.payload ?? {};
      const payload =
        'snapshot' in (rawPayload as any)
          ? (rawPayload as { snapshot?: UiLayoutStateDto; source?: 'cache' | 'server' })
          : { snapshot: rawPayload as UiLayoutStateDto, source: undefined };
      const snapshot: UiLayoutStateDto = payload.snapshot ?? {
        panels: {},
        lastUpdatedUtc: null
      };
      const source = payload.source ?? 'server';

      const nextPanels = snapshot.panels ?? {};
      const mergedPanels = { ...initialPanels, ...nextPanels };
      const nextLastUpdated = snapshot.lastUpdatedUtc ?? null;
      const hasChanged =
        state.lastUpdatedUtc !== nextLastUpdated ||
        Object.keys(mergedPanels).some((key) => {
          const prev = state.panels[key];
          const next = mergedPanels[key];
          return (
            !prev ||
            prev.visible !== next.visible ||
            prev.collapsed !== next.collapsed ||
            prev.x !== next.x ||
            prev.y !== next.y ||
            prev.w !== next.w ||
            prev.h !== next.h
          );
        });

      if (!hasChanged) {
        if (state.hydrated) return state;
        return {
          ...state,
          hydrated: true,
          hydrationSource: source
        };
      }

      return {
        panels: mergedPanels,
        lastUpdatedUtc: nextLastUpdated,
        hydrated: true,
        hydrationSource: source
      };
    }
    case UPDATE_PANEL: {
      const { panelId, layout } = (action.payload ?? {}) as {
        panelId?: string;
        layout?: PanelLayoutDto;
      };
      if (!panelId || !layout) return state;
      const nextPanels = { ...state.panels, [panelId]: layout };
      return {
        panels: nextPanels,
        lastUpdatedUtc: state.lastUpdatedUtc,
        hydrated: state.hydrated,
        hydrationSource: state.hydrationSource
      };
    }
    default:
      return state;
  }
};

export const createUiLayoutSlice = (store: StoreApi) => {
  store.registerSlice('uiLayout', initialState, reducer);

  const getState = (): UiLayoutSliceState => store.getState().uiLayout ?? initialState;

  // Hydrate once from local cache (prevents layout jump before server fetch returns)
  const cachedLayout = readLayoutCache();
  if (cachedLayout) {
    store.dispatch({
      type: HYDRATE,
      payload: { snapshot: cachedLayout, source: 'cache' as const }
    });
  }

  const applySnapshot = (
    snapshot: UiLayoutStateDto | undefined | null,
    source: 'cache' | 'server',
    persist: boolean
  ): void => {
    if (!snapshot) return;
    store.dispatch({
      type: HYDRATE,
      payload: { snapshot, source }
    });
    if (persist) {
      writeLayoutCache(getState());
    }
  };

  const hydrateFromServer = (snapshot: UiLayoutStateDto | undefined | null): void =>
    applySnapshot(snapshot, 'server', true);

  const restoreFromSnapshot = (snapshot: UiLayoutStateDto | undefined | null): void =>
    applySnapshot(snapshot, 'cache', false);

  const getSnapshot = (): UiLayoutStateDto => toDto(getState());

  const setPanelLayout = (
    panelId: string,
    layout: PanelLayoutDto,
    persist = false
  ): void => {
    store.dispatch({
      type: UPDATE_PANEL,
      payload: { panelId, layout }
    });
    if (persist) {
      writeLayoutCache(getState());
    }
  };

  const selectUiLayout = (globalState: { uiLayout?: UiLayoutSliceState }): UiLayoutSliceState =>
    globalState.uiLayout ?? initialState;

  const getPanelLayout = (panelId: string): PanelLayoutDto =>
    getState().panels[panelId] ?? initialPanels[panelId] ?? {
      visible: true,
      collapsed: false,
      x: 0,
      y: 0,
      w: 3,
      h: 8
    };

  return {
    getState,
    hydrateFromServer,
    restoreFromSnapshot,
    getSnapshot,
    setPanelLayout,
    selectUiLayout,
    getPanelLayout
  };
};

export default {
  createUiLayoutSlice
};

export const getCachedUiLayoutSnapshot = (): UiLayoutStateDto | null => readLayoutCache();
