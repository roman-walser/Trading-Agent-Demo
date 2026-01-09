// backend/infra/persist/uiLayout.repo.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { appConfig } from '../../config/index.js';
import type { UiLayoutState } from '../../states/ui.state.js';
import { uiLayoutStateSchema } from '../../state-services/ui.schema.js';

const LOG_PREFIX = '[infra:persist:uiLayout]';
const SCHEMA_VERSION = 1;
const MYSQL_TABLE = 'ui_layout_snapshots';
const MYSQL_PRESETS_TABLE = 'ui_layout_presets';
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

const uiLayoutPayloadSchema = z.object({
  schemaVersion: z.number().int(),
  layout: uiLayoutStateSchema
});

const uiLayoutSnapshotSchema = uiLayoutPayloadSchema.extend({
  tsUtc: z.string()
});

const uiLayoutPresetRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  schemaVersion: z.number().int(),
  layout: uiLayoutStateSchema,
  createdUtc: z.string().min(1),
  updatedUtc: z.string().min(1)
});

type UiLayoutPayload = z.infer<typeof uiLayoutPayloadSchema>;
type UiLayoutSnapshot = z.infer<typeof uiLayoutSnapshotSchema>;
type UiLayoutPresetRecord = z.infer<typeof uiLayoutPresetRecordSchema>;

export type UiLayoutPreset = {
  id: string;
  name: string;
  snapshot: UiLayoutState;
  createdUtc: string;
  updatedUtc: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
const ndjsonFile = path.join(dataDir, 'ui-layout.ndjson');
const presetsFile = path.join(dataDir, 'ui-layout-presets.json');

let dataDirReady = false;
let mysqlPool: Pool | null = null;
let mysqlPoolPromise: Promise<Pool> | null = null;
let mysqlTableReady = false;
let mysqlPresetsTableReady = false;

const ensureDataDir = (): void => {
  if (dataDirReady) return;
  fs.mkdirSync(dataDir, { recursive: true });
  dataDirReady = true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeHistoryLimit = (limit?: number | null): number => {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT;
  }
  const rounded = Math.floor(limit);
  if (rounded <= 0) return DEFAULT_HISTORY_LIMIT;
  return Math.min(rounded, MAX_HISTORY_LIMIT);
};

const cloneLayout = (state: UiLayoutState): UiLayoutState => ({
  panels: { ...state.panels },
  lastUpdatedUtc: state.lastUpdatedUtc
});

const sortPresets = (presets: UiLayoutPreset[]): UiLayoutPreset[] =>
  [...presets].sort((a, b) => {
    const updated = b.updatedUtc.localeCompare(a.updatedUtc);
    if (updated !== 0) return updated;
    return a.name.localeCompare(b.name);
  });

const createSnapshot = (state: UiLayoutState): UiLayoutSnapshot => ({
  tsUtc: new Date().toISOString(),
  schemaVersion: SCHEMA_VERSION,
  layout: cloneLayout(state)
});

const parseSnapshot = (value: unknown): UiLayoutSnapshot | null => {
  const parsed = uiLayoutSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.schemaVersion !== SCHEMA_VERSION) {
    console.warn(`${LOG_PREFIX} Unsupported schema version`, {
      schemaVersion: parsed.data.schemaVersion
    });
    return null;
  }
  return parsed.data;
};

const parsePayload = (value: unknown): UiLayoutPayload | null => {
  const parsed = uiLayoutPayloadSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.schemaVersion !== SCHEMA_VERSION) {
    console.warn(`${LOG_PREFIX} Unsupported schema version`, {
      schemaVersion: parsed.data.schemaVersion
    });
    return null;
  }
  return parsed.data;
};

const parsePresetRecord = (value: unknown): UiLayoutPreset | null => {
  const parsed = uiLayoutPresetRecordSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.schemaVersion !== SCHEMA_VERSION) {
    console.warn(`${LOG_PREFIX} Unsupported preset schema version`, {
      schemaVersion: parsed.data.schemaVersion
    });
    return null;
  }
  return {
    id: parsed.data.id,
    name: parsed.data.name,
    snapshot: cloneLayout(parsed.data.layout),
    createdUtc: parsed.data.createdUtc,
    updatedUtc: parsed.data.updatedUtc
  };
};

const toPresetRecord = (preset: UiLayoutPreset): UiLayoutPresetRecord => ({
  id: preset.id,
  name: preset.name,
  schemaVersion: SCHEMA_VERSION,
  layout: cloneLayout(preset.snapshot),
  createdUtc: preset.createdUtc,
  updatedUtc: preset.updatedUtc
});

const ensureMysqlPool = async (): Promise<Pool> => {
  if (mysqlPool) return mysqlPool;
  if (mysqlPoolPromise) return mysqlPoolPromise;

  const initPromise = (async () => {
    const mysqlConfig = appConfig.persistence.uiLayout.mysql;
    if (!mysqlConfig.host || !mysqlConfig.user || !mysqlConfig.database) {
      throw new Error('MySQL config missing: MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE are required.');
    }

    const pool = createPool({
      host: mysqlConfig.host,
      port: mysqlConfig.port ?? 3306,
      user: mysqlConfig.user,
      password: mysqlConfig.password ?? undefined,
      database: mysqlConfig.database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true
    });

    await pool.query('SELECT 1');
    await ensureMysqlTable(pool);
    await ensureMysqlPresetsTable(pool);
    mysqlPool = pool;
    return pool;
  })();

  mysqlPoolPromise = initPromise;

  try {
    return await initPromise;
  } catch (error) {
    mysqlPoolPromise = null;
    throw error;
  }
};

const ensureMysqlTable = async (pool: Pool): Promise<void> => {
  if (mysqlTableReady) return;
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS ${MYSQL_TABLE} (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      tsUtc VARCHAR(32) NOT NULL,
      payload JSON NOT NULL
    )`
  );
  mysqlTableReady = true;
};

const ensureMysqlPresetsTable = async (pool: Pool): Promise<void> => {
  if (mysqlPresetsTableReady) return;
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS ${MYSQL_PRESETS_TABLE} (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      payload JSON NOT NULL,
      createdUtc VARCHAR(32) NOT NULL,
      updatedUtc VARCHAR(32) NOT NULL,
      UNIQUE KEY ui_layout_presets_name (name)
    )`
  );
  mysqlPresetsTableReady = true;
};

const readLatestNdjsonSnapshot = async (): Promise<UiLayoutSnapshot | null> => {
  try {
    ensureDataDir();
    if (!fs.existsSync(ndjsonFile)) {
      return null;
    }

    const content = await fs.promises.readFile(ndjsonFile, 'utf8');
    if (!content.trim()) {
      return null;
    }

    const lines = content.trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]?.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        const snapshot = parseSnapshot(parsed);
        if (snapshot) {
          return snapshot;
        }
        console.warn(`${LOG_PREFIX} Skipping invalid NDJSON snapshot line.`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to parse NDJSON snapshot line.`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return null;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read NDJSON snapshot.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

const readRecentNdjsonSnapshots = async (limit: number): Promise<UiLayoutSnapshot[]> => {
  try {
    ensureDataDir();
    if (!fs.existsSync(ndjsonFile)) {
      return [];
    }

    const content = await fs.promises.readFile(ndjsonFile, 'utf8');
    if (!content.trim()) {
      return [];
    }

    const lines = content.trim().split(/\r?\n/);
    const snapshots: UiLayoutSnapshot[] = [];
    for (let i = lines.length - 1; i >= 0 && snapshots.length < limit; i -= 1) {
      const line = lines[i]?.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        const snapshot = parseSnapshot(parsed);
        if (snapshot) {
          snapshots.push(snapshot);
        } else {
          console.warn(`${LOG_PREFIX} Skipping invalid NDJSON snapshot line.`);
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to parse NDJSON snapshot line.`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return snapshots.reverse();
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read NDJSON history.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
};

const appendNdjsonSnapshot = async (snapshot: UiLayoutSnapshot): Promise<boolean> => {
  try {
    ensureDataDir();
    const line = `${JSON.stringify(snapshot)}\n`;
    await fs.promises.appendFile(ndjsonFile, line, 'utf8');
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to append NDJSON snapshot.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const readLatestMysqlSnapshot = async (): Promise<UiLayoutSnapshot | null> => {
  try {
    const pool = await ensureMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tsUtc, payload FROM ${MYSQL_TABLE} ORDER BY id DESC LIMIT 1`
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const row = rows[0] as { tsUtc: string; payload: unknown };
    let rawPayload: unknown = row.payload;
    if (typeof rawPayload === 'string') {
      try {
        rawPayload = JSON.parse(rawPayload);
      } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to parse MySQL payload JSON.`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    }

    const payload = parsePayload(rawPayload);
    if (!payload) {
      console.warn(`${LOG_PREFIX} Invalid MySQL payload, skipping.`);
      return null;
    }

    return {
      tsUtc: row.tsUtc,
      schemaVersion: payload.schemaVersion,
      layout: payload.layout
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read MySQL snapshot.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

const readRecentMysqlSnapshots = async (limit: number): Promise<UiLayoutSnapshot[]> => {
  try {
    const pool = await ensureMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tsUtc, payload FROM ${MYSQL_TABLE} ORDER BY id DESC LIMIT ?`,
      [limit]
    );

    if (!rows || rows.length === 0) {
      return [];
    }

    const snapshots: UiLayoutSnapshot[] = [];
    for (const row of rows) {
      const typed = row as { tsUtc: string; payload: unknown };
      let rawPayload: unknown = typed.payload;
      if (typeof rawPayload === 'string') {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch (error) {
          console.warn(`${LOG_PREFIX} Failed to parse MySQL payload JSON.`, {
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      const payload = parsePayload(rawPayload);
      if (!payload) {
        console.warn(`${LOG_PREFIX} Invalid MySQL payload, skipping.`);
        continue;
      }

      snapshots.push({
        tsUtc: typed.tsUtc,
        schemaVersion: payload.schemaVersion,
        layout: payload.layout
      });
    }

    return snapshots.reverse();
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read MySQL history.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
};

const appendMysqlSnapshot = async (snapshot: UiLayoutSnapshot): Promise<boolean> => {
  try {
    const pool = await ensureMysqlPool();
    const payload = JSON.stringify({
      schemaVersion: snapshot.schemaVersion,
      layout: snapshot.layout
    });
    await pool.execute(
      `INSERT INTO ${MYSQL_TABLE} (tsUtc, payload) VALUES (?, ?)`,
      [snapshot.tsUtc, payload]
    );
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to append MySQL snapshot.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const readNdjsonPresets = async (): Promise<UiLayoutPreset[]> => {
  try {
    ensureDataDir();
    if (!fs.existsSync(presetsFile)) {
      return [];
    }

    const raw = await fs.promises.readFile(presetsFile, 'utf8');
    if (!raw.trim()) {
      return [];
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to parse presets file JSON.`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }

    if (!isRecord(parsed)) {
      return [];
    }

    const rawPresets = Array.isArray(parsed.presets) ? parsed.presets : [];
    const presets: UiLayoutPreset[] = [];
    for (const rawPreset of rawPresets) {
      const preset = parsePresetRecord(rawPreset);
      if (preset) {
        presets.push(preset);
      } else {
        console.warn(`${LOG_PREFIX} Skipping invalid layout preset record.`);
      }
    }

    return sortPresets(presets);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read layout presets.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
};

const writeNdjsonPresets = async (presets: UiLayoutPreset[]): Promise<boolean> => {
  try {
    ensureDataDir();
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      presets: presets.map((preset) => toPresetRecord(preset))
    };
    await fs.promises.writeFile(presetsFile, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to write layout presets.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const readMysqlPresets = async (): Promise<UiLayoutPreset[]> => {
  try {
    const pool = await ensureMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, payload, createdUtc, updatedUtc FROM ${MYSQL_PRESETS_TABLE} ORDER BY updatedUtc DESC, name ASC`
    );
    if (!rows || rows.length === 0) {
      return [];
    }

    const presets: UiLayoutPreset[] = [];
    for (const row of rows) {
      const typed = row as {
        id: string;
        name: string;
        payload: unknown;
        createdUtc: string;
        updatedUtc: string;
      };
      let rawPayload: unknown = typed.payload;
      if (typeof rawPayload === 'string') {
        try {
          rawPayload = JSON.parse(rawPayload);
        } catch (error) {
          console.warn(`${LOG_PREFIX} Failed to parse MySQL preset payload JSON.`, {
            error: error instanceof Error ? error.message : String(error)
          });
          continue;
        }
      }

      const payload = parsePayload(rawPayload);
      if (!payload) {
        console.warn(`${LOG_PREFIX} Invalid MySQL preset payload, skipping.`);
        continue;
      }

      presets.push({
        id: typed.id,
        name: typed.name,
        snapshot: cloneLayout(payload.layout),
        createdUtc: typed.createdUtc,
        updatedUtc: typed.updatedUtc
      });
    }

    return sortPresets(presets);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to read MySQL presets.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
};

const insertMysqlPreset = async (preset: UiLayoutPreset): Promise<boolean> => {
  try {
    const pool = await ensureMysqlPool();
    const payload = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      layout: preset.snapshot
    });
    await pool.execute<ResultSetHeader>(
      `INSERT INTO ${MYSQL_PRESETS_TABLE} (id, name, payload, createdUtc, updatedUtc) VALUES (?, ?, ?, ?, ?)`,
      [preset.id, preset.name, payload, preset.createdUtc, preset.updatedUtc]
    );
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to insert MySQL preset.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const updateMysqlPresetName = async (preset: UiLayoutPreset): Promise<boolean> => {
  try {
    const pool = await ensureMysqlPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE ${MYSQL_PRESETS_TABLE} SET name = ?, updatedUtc = ? WHERE id = ?`,
      [preset.name, preset.updatedUtc, preset.id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to rename MySQL preset.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const deleteMysqlPreset = async (presetId: string): Promise<boolean> => {
  try {
    const pool = await ensureMysqlPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM ${MYSQL_PRESETS_TABLE} WHERE id = ?`,
      [presetId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to delete MySQL preset.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const resetNdjsonHistory = async (snapshot: UiLayoutSnapshot): Promise<boolean> => {
  try {
    ensureDataDir();
    const line = `${JSON.stringify(snapshot)}\n`;
    await fs.promises.writeFile(ndjsonFile, line, 'utf8');
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to reset NDJSON history.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const resetMysqlHistory = async (snapshot: UiLayoutSnapshot): Promise<boolean> => {
  let connection: Awaited<ReturnType<Pool['getConnection']>> | null = null;
  try {
    const pool = await ensureMysqlPool();
    connection = await pool.getConnection();
    await connection.query('START TRANSACTION');
    await connection.query(`DELETE FROM ${MYSQL_TABLE}`);
    const payload = JSON.stringify({
      schemaVersion: snapshot.schemaVersion,
      layout: snapshot.layout
    });
    await connection.execute(
      `INSERT INTO ${MYSQL_TABLE} (tsUtc, payload) VALUES (?, ?)`,
      [snapshot.tsUtc, payload]
    );
    await connection.query('COMMIT');
    return true;
  } catch (error) {
    try {
      if (connection) {
        await connection.query('ROLLBACK');
      }
    } catch {
      // ignore rollback errors
    }
    console.error(`${LOG_PREFIX} Failed to reset MySQL history.`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Loads the latest UI layout snapshot from persistence.
 */
export const loadUiLayoutSnapshot = async (): Promise<UiLayoutState | null> => {
  const adapter = appConfig.persistence.uiLayout.adapter;
  const snapshot =
    adapter === 'mysql' ? await readLatestMysqlSnapshot() : await readLatestNdjsonSnapshot();
  return snapshot?.layout ?? null;
};

/**
 * Loads the most recent UI layout history snapshots.
 */
export const loadUiLayoutHistory = async (limit?: number): Promise<UiLayoutState[]> => {
  const adapter = appConfig.persistence.uiLayout.adapter;
  const safeLimit = normalizeHistoryLimit(limit);
  const snapshots =
    adapter === 'mysql'
      ? await readRecentMysqlSnapshots(safeLimit)
      : await readRecentNdjsonSnapshots(safeLimit);
  return snapshots.map((snapshot) => snapshot.layout);
};

/**
 * Clears history while keeping the current layout as the latest snapshot.
 */
export const resetUiLayoutHistory = async (layout: UiLayoutState): Promise<boolean> => {
  const snapshot = createSnapshot(layout);
  const adapter = appConfig.persistence.uiLayout.adapter;
  return adapter === 'mysql'
    ? await resetMysqlHistory(snapshot)
    : await resetNdjsonHistory(snapshot);
};

/**
 * Persists the current UI layout snapshot.
 */
export const persistUiLayoutSnapshot = async (layout: UiLayoutState): Promise<boolean> => {
  const snapshot = createSnapshot(layout);
  const adapter = appConfig.persistence.uiLayout.adapter;
  return adapter === 'mysql'
    ? await appendMysqlSnapshot(snapshot)
    : await appendNdjsonSnapshot(snapshot);
};

/**
 * Loads saved UI layout presets.
 */
export const loadUiLayoutPresets = async (): Promise<UiLayoutPreset[]> => {
  const adapter = appConfig.persistence.uiLayout.adapter;
  return adapter === 'mysql' ? await readMysqlPresets() : await readNdjsonPresets();
};

/**
 * Persists a new UI layout preset.
 */
export const persistUiLayoutPreset = async (preset: UiLayoutPreset): Promise<boolean> => {
  const adapter = appConfig.persistence.uiLayout.adapter;
  if (adapter === 'mysql') {
    return await insertMysqlPreset(preset);
  }
  const presets = await readNdjsonPresets();
  return await writeNdjsonPresets(sortPresets([...presets, preset]));
};

/**
 * Updates a UI layout preset (rename).
 */
export const renameUiLayoutPreset = async (preset: UiLayoutPreset): Promise<boolean> => {
  const adapter = appConfig.persistence.uiLayout.adapter;
  if (adapter === 'mysql') {
    return await updateMysqlPresetName(preset);
  }
  const presets = await readNdjsonPresets();
  const hasPreset = presets.some((entry) => entry.id === preset.id);
  if (!hasPreset) {
    return false;
  }
  const next = presets.map((entry) => (entry.id === preset.id ? preset : entry));
  return await writeNdjsonPresets(sortPresets(next));
};

/**
 * Deletes a UI layout preset by id.
 */
export const deleteUiLayoutPreset = async (presetId: string): Promise<boolean> => {
  const adapter = appConfig.persistence.uiLayout.adapter;
  if (adapter === 'mysql') {
    return await deleteMysqlPreset(presetId);
  }
  const presets = await readNdjsonPresets();
  const next = presets.filter((entry) => entry.id !== presetId);
  if (next.length === presets.length) {
    return false;
  }
  return await writeNdjsonPresets(sortPresets(next));
};

/**
 * Closes the persistence adapter (MySQL pool).
 */
export const closeUiLayoutAdapter = async (): Promise<void> => {
  if (appConfig.persistence.uiLayout.adapter !== 'mysql') return;
  if (!mysqlPool) return;
  try {
    await mysqlPool.end();
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to close MySQL pool.`, {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    mysqlPool = null;
    mysqlPoolPromise = null;
    mysqlTableReady = false;
    mysqlPresetsTableReady = false;
  }
};
