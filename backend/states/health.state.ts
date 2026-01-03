// backend/states/health.state.ts
export type HealthState = {
  ok: boolean;
  serverTimeUtc: string;
  lastCheckedAtUtc: string | null;
};

const healthState: HealthState = {
  ok: true,
  serverTimeUtc: '',
  lastCheckedAtUtc: null
};

const cloneState = (state: HealthState): HealthState => ({ ...state });

/**
 * Updates the in-memory health slice.
 */
export const setHealthState = (next: HealthState): HealthState => {
  healthState.ok = next.ok;
  healthState.serverTimeUtc = next.serverTimeUtc;
  healthState.lastCheckedAtUtc = next.lastCheckedAtUtc;
  return cloneState(healthState);
};

/**
 * Returns a defensive copy of the health slice.
 */
export const getHealthState = (): HealthState => cloneState(healthState);
