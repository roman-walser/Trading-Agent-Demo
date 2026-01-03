// frontend/state/health.slice.ts
import type { StoreAction, StoreApi } from './store.js';
import type { HealthResponse } from '../api/routes/health.api.js';

export type HealthSliceState = {
  ok: boolean;
  serverTimeUtc: string;
  lastCheckedAtUtc: string | null;
};

const HYDRATE_FROM_HEALTH = 'health/hydrateFromHealth';

const initialState: HealthSliceState = {
  ok: false,
  serverTimeUtc: '',
  lastCheckedAtUtc: null
};

const isSame = (a: HealthSliceState, b: HealthSliceState): boolean =>
  a.ok === b.ok &&
  a.serverTimeUtc === b.serverTimeUtc &&
  a.lastCheckedAtUtc === b.lastCheckedAtUtc;

const reducer = (
  state: HealthSliceState = initialState,
  action: StoreAction
): HealthSliceState => {
  if (action.type !== HYDRATE_FROM_HEALTH) {
    return state;
  }

  const payload = action.payload ?? {};
  const nextOk = typeof (payload as HealthSliceState).ok === 'boolean'
    ? (payload as HealthSliceState).ok
    : state.ok;
  const nextServerTimeUtc =
    typeof (payload as HealthSliceState).serverTimeUtc === 'string'
      ? (payload as HealthSliceState).serverTimeUtc
      : state.serverTimeUtc;
  const nextLastCheckedAtUtc =
    (payload as HealthSliceState).lastCheckedAtUtc === null ||
    typeof (payload as HealthSliceState).lastCheckedAtUtc === 'string'
      ? (payload as HealthSliceState).lastCheckedAtUtc ?? null
      : state.lastCheckedAtUtc;

  const nextState: HealthSliceState = {
    ok: nextOk,
    serverTimeUtc: nextServerTimeUtc,
    lastCheckedAtUtc: nextLastCheckedAtUtc
  };

  return isSame(state, nextState) ? state : nextState;
};

/**
 * Registers the health slice and provides helpers for hydration/selectors.
 */
export const createHealthSlice = (store: StoreApi) => {
  store.registerSlice('health', initialState, reducer);

  const getState = (): HealthSliceState => store.getState().health ?? initialState;

  const hydrateFromHealthResponse = (response?: HealthResponse | null): void => {
    const serverTimeUtc = response?.serverTimeUtc;
    store.dispatch({
      type: HYDRATE_FROM_HEALTH,
      payload: {
        ok: response?.ok,
        serverTimeUtc,
        lastCheckedAtUtc: serverTimeUtc ?? null
      }
    });
  };

  const selectHealth = (globalState: { health?: HealthSliceState }): HealthSliceState =>
    globalState.health ?? initialState;

  return {
    getState,
    hydrateFromHealthResponse,
    selectHealth
  };
};

export default {
  createHealthSlice
};
