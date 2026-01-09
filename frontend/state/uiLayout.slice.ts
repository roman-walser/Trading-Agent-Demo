// frontend/state/uiLayout.slice.ts
import type { StoreAction, StoreApi } from './store.js';
import type { PanelLayoutDto, UiLayoutStateDto } from '../api/routes/uiLayout.api.js';

const LAYOUT_STORAGE_KEY = 'ui-layout-cache';
export const UI_LAYOUT_HISTORY_LIMIT = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPanelLayoutDto = (value: unknown): value is PanelLayoutDto => {
  if (!isRecord(value)) return false;
  return (
    typeof value.visible === 'boolean' &&
    typeof value.collapsed === 'boolean' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.w) &&
    isFiniteNumber(value.h)
  );
};

const clonePanels = (
  panels: Record<string, PanelLayoutDto>
): Record<string, PanelLayoutDto> => {
  const next: Record<string, PanelLayoutDto> = {};
  for (const [key, layout] of Object.entries(panels)) {
    next[key] = { ...layout };
  }
  return next;
};

const normalizeCachedSnapshot = (value: unknown): UiLayoutStateDto | null => {
  if (!isRecord(value)) return null;
  const rawPanels = value.panels;
  if (!isRecord(rawPanels)) return null;
  const panels: Record<string, PanelLayoutDto> = {};
  for (const [key, layout] of Object.entries(rawPanels)) {
    if (isPanelLayoutDto(layout)) {
      panels[key] = { ...layout };
    }
  }
  const lastUpdatedUtc =
    typeof value.lastUpdatedUtc === 'string' || value.lastUpdatedUtc === null
      ? value.lastUpdatedUtc
      : null;
  return { panels, lastUpdatedUtc };
};

const toDto = (state: UiLayoutSliceState): UiLayoutStateDto => ({
  panels: clonePanels(state.panels),
  lastUpdatedUtc: state.lastUpdatedUtc
});

const readLayoutCache = (): UiLayoutStateDto | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return normalizeCachedSnapshot(parsed);
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
  hydrationSource: 'cache' | 'server' | 'history' | null;
  historyPast: UiLayoutStateDto[];
  historyFuture: UiLayoutStateDto[];
};

const HYDRATE = 'uiLayout/hydrate';
const UPDATE_PANEL = 'uiLayout/updatePanel';
const APPLY_SNAPSHOT_WITH_HISTORY = 'uiLayout/applySnapshotWithHistory';

const initialPanels: Record<string, PanelLayoutDto> = {
  health: { visible: true, collapsed: false, x: 0, y: 0, w: 3, h: 8 }
};

const initialState: UiLayoutSliceState = {
  panels: clonePanels(initialPanels),
  lastUpdatedUtc: null,
  hydrated: false,
  hydrationSource: null,
  historyPast: [],
  historyFuture: []
};

const normalizeSnapshot = (snapshot?: UiLayoutStateDto | null): UiLayoutStateDto => ({
  panels: snapshot?.panels ?? {},
  lastUpdatedUtc: snapshot?.lastUpdatedUtc ?? null
});

const isSameLayout = (left: UiLayoutStateDto, right: UiLayoutStateDto): boolean => {
  const leftPanels = left.panels ?? {};
  const rightPanels = right.panels ?? {};
  const keys = new Set([...Object.keys(leftPanels), ...Object.keys(rightPanels)]);
  for (const key of keys) {
    const leftPanel = leftPanels[key];
    const rightPanel = rightPanels[key];
    if (!leftPanel || !rightPanel) return false;
    if (
      leftPanel.visible !== rightPanel.visible ||
      leftPanel.collapsed !== rightPanel.collapsed ||
      leftPanel.x !== rightPanel.x ||
      leftPanel.y !== rightPanel.y ||
      leftPanel.w !== rightPanel.w ||
      leftPanel.h !== rightPanel.h
    ) {
      return false;
    }
  }
  return true;
};

const limitHistory = (entries: UiLayoutStateDto[]): UiLayoutStateDto[] => {
  if (entries.length <= UI_LAYOUT_HISTORY_LIMIT) return entries;
  return entries.slice(entries.length - UI_LAYOUT_HISTORY_LIMIT);
};

const applySnapshotToState = (
  state: UiLayoutSliceState,
  snapshot: UiLayoutStateDto,
  source: 'cache' | 'server' | 'history'
): UiLayoutSliceState => {
  const normalized = normalizeSnapshot(snapshot);
  const mergedPanels = {
    ...clonePanels(initialPanels),
    ...clonePanels(normalized.panels ?? {})
  };
  const nextLastUpdated = normalized.lastUpdatedUtc ?? null;
  const hasRemovedPanels = Object.keys(state.panels).some((key) => !(key in mergedPanels));
  const hasChanged =
    state.lastUpdatedUtc !== nextLastUpdated ||
    hasRemovedPanels ||
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
    ...state,
    panels: mergedPanels,
    lastUpdatedUtc: nextLastUpdated,
    hydrated: true,
    hydrationSource: source
  };
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
      const snapshot = normalizeSnapshot(payload.snapshot);
      const source = payload.source ?? 'server';
      return applySnapshotToState(state, snapshot, source);
    }
    case UPDATE_PANEL: {
      const { panelId, layout } = (action.payload ?? {}) as {
        panelId?: string;
        layout?: PanelLayoutDto;
      };
      if (!panelId || !layout) return state;
      const nextPanels = { ...state.panels, [panelId]: layout };
      return {
        ...state,
        panels: nextPanels
      };
    }
    case APPLY_SNAPSHOT_WITH_HISTORY: {
      const payload = (action.payload ?? {}) as {
        snapshot?: UiLayoutStateDto;
        historyPast?: UiLayoutStateDto[];
        historyFuture?: UiLayoutStateDto[];
        source?: 'cache' | 'server' | 'history';
      };
      const snapshot = normalizeSnapshot(payload.snapshot);
      const source = payload.source ?? 'history';
      const baseState = applySnapshotToState(state, snapshot, source);
      const nextState = baseState === state ? { ...state } : baseState;
      return {
        ...nextState,
        historyPast: payload.historyPast ?? state.historyPast,
        historyFuture: payload.historyFuture ?? state.historyFuture
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

  const applyHistorySnapshot = (
    snapshot: UiLayoutStateDto,
    historyPast: UiLayoutStateDto[],
    historyFuture: UiLayoutStateDto[],
    source: 'server' | 'history' = 'history',
    persist = true
  ): void => {
    store.dispatch({
      type: APPLY_SNAPSHOT_WITH_HISTORY,
      payload: {
        snapshot,
        historyPast,
        historyFuture,
        source
      }
    });
    if (persist) {
      writeLayoutCache(getState());
    }
  };

  const clearHistory = (persist = true): void => {
    applyHistorySnapshot(getSnapshot(), [], [], 'history', persist);
  };

  const recordHistory = (previousSnapshot: UiLayoutStateDto, nextSnapshot: UiLayoutStateDto): void => {
    if (!previousSnapshot || !nextSnapshot) return;
    if (isSameLayout(previousSnapshot, nextSnapshot)) {
      applySnapshot(nextSnapshot, 'server', true);
      return;
    }
    const state = getState();
    const nextPast = limitHistory([...state.historyPast, previousSnapshot]);
    applyHistorySnapshot(nextSnapshot, nextPast, [], 'server', true);
  };

  const getHistoryState = (): { past: UiLayoutStateDto[]; future: UiLayoutStateDto[] } => {
    const state = getState();
    return {
      past: state.historyPast,
      future: state.historyFuture
    };
  };

  const canGoBack = (): boolean => getState().historyPast.length > 0;

  const canGoForward = (): boolean => getState().historyFuture.length > 0;

  const getHistoryNavigation = (
    direction: 'back' | 'forward'
  ): { snapshot: UiLayoutStateDto; past: UiLayoutStateDto[]; future: UiLayoutStateDto[] } | null => {
    const state = getState();
    const current = toDto(state);
    if (direction === 'back') {
      if (state.historyPast.length === 0) return null;
      const snapshot = state.historyPast[state.historyPast.length - 1];
      return {
        snapshot,
        past: state.historyPast.slice(0, -1),
        future: [current, ...state.historyFuture]
      };
    }
    if (state.historyFuture.length === 0) return null;
    const snapshot = state.historyFuture[0];
    return {
      snapshot,
      past: limitHistory([...state.historyPast, current]),
      future: state.historyFuture.slice(1)
    };
  };

  const goBack = (): UiLayoutStateDto | null => {
    const navigation = getHistoryNavigation('back');
    if (!navigation) return null;
    applyHistorySnapshot(navigation.snapshot, navigation.past, navigation.future, 'history', true);
    return navigation.snapshot;
  };

  const goForward = (): UiLayoutStateDto | null => {
    const navigation = getHistoryNavigation('forward');
    if (!navigation) return null;
    applyHistorySnapshot(navigation.snapshot, navigation.past, navigation.future, 'history', true);
    return navigation.snapshot;
  };

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

  const getDefaultPanels = (): Record<string, PanelLayoutDto> => clonePanels(initialPanels);

  return {
    getState,
    hydrateFromServer,
    restoreFromSnapshot,
    getSnapshot,
    clearHistory,
    recordHistory,
    applyHistorySnapshot,
    getHistoryState,
    getHistoryNavigation,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    setPanelLayout,
    selectUiLayout,
    getPanelLayout,
    getDefaultPanels
  };
};

export default {
  createUiLayoutSlice
};

export const getCachedUiLayoutSnapshot = (): UiLayoutStateDto | null => readLayoutCache();
