// backend/server/http/routes/health/health.schemas.ts
import { z } from 'zod';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  serverTimeUtc: z.string(),
  version: z.string()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
