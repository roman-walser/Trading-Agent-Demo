// frontend/query/health.queries.ts
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, type HealthResponse } from '../api/routes/health.api.js';
import { hydrateFromHealthResponse } from '../state/store.js';

const HEALTH_QUERY_KEY = ['health'];

export const useHealthQuery = (refetchInterval: number, enabled = true) =>
  useQuery<HealthResponse>({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: fetchHealth,
    refetchInterval: enabled ? refetchInterval : false,
    refetchOnWindowFocus: false,
    staleTime: refetchInterval,
    enabled,
    onSuccess: (snapshot) => hydrateFromHealthResponse(snapshot)
  });
