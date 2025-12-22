// frontend/api/health.api.ts
import { getJson } from './httpClient.js';

export type HealthResponse = {
  ok: boolean;
  serverTimeUtc: string;
  version: string;
};

export const fetchHealth = async (): Promise<HealthResponse> => getJson<HealthResponse>('/api/health');
