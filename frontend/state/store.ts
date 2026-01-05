// frontend/state/store.ts
import { useSyncExternalStore } from 'react';
import { createHealthSlice, type HealthSliceState } from './health.slice.js';
import { createUiLayoutSlice, type UiLayoutSliceState } from './uiLayout.slice.js';

export type StoreAction = {
  type: string;
  payload?: unknown;
};

type StoreListener = () => void;

type SliceReducer<T> = (state: T, action: StoreAction) => T;

export type StoreState = {
  health?: HealthSliceState;
  uiLayout?: UiLayoutSliceState;
  [key: string]: unknown;
};

export type StoreApi = {
  getState: () => StoreState;
  dispatch: (action: StoreAction) => void;
  subscribe: (listener: StoreListener) => () => void;
  registerSlice: <T>(key: string, initialState: T, reducer: SliceReducer<T>) => void;
};

/**
 * Minimal slice store for frontend state hydration.
 */
const createStore = (): StoreApi => {
  let state: StoreState = {};
  const reducers = new Map<string, SliceReducer<unknown>>();
  const listeners = new Set<StoreListener>();

  const getState = (): StoreState => state;

  const registerSlice = <T>(key: string, initialState: T, reducer: SliceReducer<T>): void => {
    if (reducers.has(key)) {
      return;
    }

    reducers.set(key, reducer as SliceReducer<unknown>);
    state = { ...state, [key]: initialState };
  };

  const dispatch = (action: StoreAction): void => {
    if (reducers.size === 0) return;

    let nextState = state;
    let hasChanges = false;

    for (const [key, reducer] of reducers.entries()) {
      const previousSlice = state[key];
      const nextSlice = reducer(previousSlice, action);

      if (nextSlice !== previousSlice) {
        if (!hasChanges) {
          nextState = { ...state };
          hasChanges = true;
        }
        (nextState as Record<string, unknown>)[key] = nextSlice;
      }
    }

    if (hasChanges) {
      state = nextState;
      listeners.forEach((listener) => listener());
    }
  };

  const subscribe = (listener: StoreListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    getState,
    dispatch,
    subscribe,
    registerSlice
  };
};

const store = createStore();
const healthSlice = createHealthSlice(store);
const uiLayoutSlice = createUiLayoutSlice(store);

/**
 * React hook for selecting a slice of the store.
 */
export const useStoreSelector = <T>(selector: (state: StoreState) => T): T =>
  useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );

/**
 * Health slice selector hook used by the dashboard.
 */
export const useHealthState = (): HealthSliceState =>
  useStoreSelector((state) => healthSlice.selectHealth(state));

export const hydrateFromHealthResponse = healthSlice.hydrateFromHealthResponse;
export const hydrateUiLayoutFromSnapshot = uiLayoutSlice.hydrateFromServer;
export const restoreUiLayoutSnapshot = uiLayoutSlice.restoreFromSnapshot;
export const getUiLayoutSnapshot = uiLayoutSlice.getSnapshot;
export const setPanelLayout = uiLayoutSlice.setPanelLayout;
export const getPanelLayout = uiLayoutSlice.getPanelLayout;
export const useUiLayoutState = (): UiLayoutSliceState =>
  useStoreSelector((state) => uiLayoutSlice.selectUiLayout(state));
export { getCachedUiLayoutSnapshot } from './uiLayout.slice.js';

export { store };
