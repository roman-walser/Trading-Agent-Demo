// backend/state-services/health.service.ts
import { getHealthState, setHealthState, type HealthState } from '../states/health.state.js';

const HEALTH_REFRESH_INTERVAL_MS = 5000;
const formatUtcSeconds = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const shouldRefresh = (state: HealthState, nowMs: number): boolean => {
  if (!state.lastCheckedAtUtc) return true;
  const lastCheckedMs = Date.parse(state.lastCheckedAtUtc);
  if (!Number.isFinite(lastCheckedMs)) return true;
  return nowMs - lastCheckedMs >= HEALTH_REFRESH_INTERVAL_MS;
};

/**
 * Builds and stores the latest health snapshot in the slice.
 */
export const refreshHealthState = (): HealthState => {
  const current = getHealthState();
  const now = new Date();
  const nowMs = now.getTime();

  if (!shouldRefresh(current, nowMs)) {
    return current;
  }

  const nowUtc = formatUtcSeconds(now);
  return setHealthState({
    ok: true,
    serverTimeUtc: nowUtc,
    lastCheckedAtUtc: nowUtc
  });
};

/**
 * Returns a defensive snapshot of the health slice.
 */
export const getHealthSnapshot = (): HealthState => getHealthState();
