// backend/config/app.config.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default('3000'),
  LOG_LEVEL: z.enum(['info', 'debug']).default('info'),
  WS_PATH: z.string().default('/ws')
});

const env = envSchema.parse(process.env);

const normalizeWsPath = (path: string): string => {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
};

export const appConfig = {
  http: {
    port: Number(env.PORT)
  },
  logging: {
    level: env.LOG_LEVEL
  },
  ws: {
    path: normalizeWsPath(env.WS_PATH)
  },
  meta: {
    version: process.env.npm_package_version ?? '0.0.0'
  }
};

export type AppConfig = typeof appConfig;
