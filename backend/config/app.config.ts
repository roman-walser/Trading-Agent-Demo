// backend/config/app.config.ts
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const trimToUndefined = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const lowerTrim = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.toLowerCase() : undefined;
};

const envSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default('3000'),
  LOG_LEVEL: z.enum(['info', 'debug']).default('info'),
  WS_PATH: z.string().default('/ws'),
  UI_PERSIST_ADAPTER: z.preprocess(
    lowerTrim,
    z.enum(['ndjson', 'mysql']).default('ndjson')
  ),
  MYSQL_HOST: z.preprocess(trimToUndefined, z.string().optional()),
  MYSQL_PORT: z.preprocess(trimToUndefined, z.string().regex(/^\d+$/).optional()),
  MYSQL_USER: z.preprocess(trimToUndefined, z.string().optional()),
  MYSQL_PASSWORD: z.string().optional(),
  MYSQL_DATABASE: z.preprocess(trimToUndefined, z.string().optional())
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
  persistence: {
    uiLayout: {
      adapter: env.UI_PERSIST_ADAPTER,
      mysql: {
        host: env.MYSQL_HOST ?? null,
        port: env.MYSQL_PORT ? Number(env.MYSQL_PORT) : 3306,
        user: env.MYSQL_USER ?? null,
        password: env.MYSQL_PASSWORD ?? null,
        database: env.MYSQL_DATABASE ?? null
      }
    }
  },
  meta: {
    version: process.env.npm_package_version ?? '0.0.0'
  }
};

export type AppConfig = typeof appConfig;
