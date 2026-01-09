// scripts/tests/smoke/03_infra_persist/00_ui_layout_persist.smoke.js
import { spawn, spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import fs from 'fs';
import { createPool } from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..');
dotenv.config({ path: path.join(rootDir, '.env') });

const resultPath = path.join(__dirname, '00_ui_layout_persist.smoke.result.json');
const port = process.env.PORT ?? '3000';
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${port}`;
const shouldSpawnBackend = process.env.SMOKE_SPAWN_BACKEND !== 'false';
const adapter = (process.env.UI_PERSIST_ADAPTER ?? 'ndjson').trim().toLowerCase();
const runRestartCheck = process.env.SMOKE_RESTART !== 'false';
const cleanupMode = process.env.NODE_CLEANUP_MODE ?? 'skip';

let backendLogs = { stdout: '', stderr: '' };
let backendExit = null;
let backendReady = true;
let childProcess = null;

const ndjsonFile = path.join(rootDir, 'backend', 'data', 'ui-layout.ndjson');
const mysqlTable = 'ui_layout_snapshots';

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const startupTimeoutMs = toNumber(process.env.SMOKE_STARTUP_TIMEOUT_MS, 15000);
const startupIntervalMs = toNumber(process.env.SMOKE_STARTUP_INTERVAL_MS, 250);
const mysqlPortValue = process.env.MYSQL_PORT?.trim();
const mysqlConfig = {
  host: process.env.MYSQL_HOST?.trim() ?? '',
  port: toNumber(mysqlPortValue && mysqlPortValue.length > 0 ? mysqlPortValue : undefined, 3306),
  user: process.env.MYSQL_USER?.trim() ?? '',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE?.trim() ?? ''
};
const mysqlConfigured = Boolean(mysqlConfig.host && mysqlConfig.user && mysqlConfig.database);

const fetchJson = async (relativePath) => {
  try {
    const response = await fetch(`${baseUrl}${relativePath}`);
    const body = await response
      .json()
      .catch(() => ({ parseError: true, text: 'Unable to parse JSON body' }));

    return {
      path: relativePath,
      status: response.status,
      ok: response.ok,
      body
    };
  } catch (error) {
    return {
      path: relativePath,
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : 'unknown error'
    };
  }
};

const fetchJsonWithOptions = async (relativePath, options = {}) => {
  try {
    const { method = 'GET', body } = options;
    const hasBody = body !== undefined;
    const response = await fetch(`${baseUrl}${relativePath}`, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined
    });
    const parsed = await response
      .json()
      .catch(() => ({ parseError: true, text: 'Unable to parse JSON body' }));

    return {
      path: relativePath,
      method,
      status: response.status,
      ok: response.ok,
      body: parsed
    };
  } catch (error) {
    return {
      path: relativePath,
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : 'unknown error'
    };
  }
};

const waitForExit = (child, timeoutMs) =>
  new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

const forceKill = (child) => {
  if (!child || child.exitCode !== null || child.signalCode) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    console.error('Force kill failed:', error);
  }
};

const stopBackend = async (child) => {
  if (!child || child.exitCode !== null || child.signalCode) return;
  try {
    child.kill('SIGTERM');
  } catch (error) {
    console.error('Failed to terminate backend:', error);
    return;
  }
  const exited = await waitForExit(child, 2000);
  if (!exited) {
    forceKill(child);
    await waitForExit(child, 2000);
  }
};

const cleanupChildProcess = async (reason) => {
  if (!childProcess || childProcess.exitCode !== null || childProcess.signalCode) return;
  console.error(`Cleaning up backend${reason ? ` (${reason})` : ''}...`);
  await stopBackend(childProcess);
};

const registerCleanupHandlers = () => {
  process.on('exit', () => {
    if (childProcess && childProcess.exitCode === null && !childProcess.signalCode) {
      forceKill(childProcess);
    }
  });
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      void cleanupChildProcess(signal).finally(() => process.exit(1));
    });
  });
  process.on('uncaughtException', (error) => {
    console.error(error);
    void cleanupChildProcess('uncaughtException').finally(() => process.exit(1));
  });
  process.on('unhandledRejection', (error) => {
    console.error(error);
    void cleanupChildProcess('unhandledRejection').finally(() => process.exit(1));
  });
};

registerCleanupHandlers();

const startBackend = () => {
  backendLogs = { stdout: '', stderr: '' };
  backendExit = null;
  const child = spawn(process.execPath, ['--import', 'tsx', 'backend/index.ts'], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: port,
      NODE_CLEANUP_MODE: cleanupMode,
      UI_PERSIST_ADAPTER: adapter
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  });

  child.stdout?.on('data', (chunk) => {
    backendLogs.stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    backendLogs.stderr += chunk.toString();
  });

  child.on('exit', (code, signal) => {
    backendExit = { code, signal };
  });

  return child;
};

const waitForServer = async () => {
  const maxAttempts = Math.max(1, Math.ceil(startupTimeoutMs / startupIntervalMs));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (backendExit) {
      return false;
    }
    const result = await fetchJson('/health');
    if (result.ok) return true;
    await wait(startupIntervalMs);
  }
  return false;
};

const readLatestNdjsonSnapshot = async () => {
  try {
    if (!fs.existsSync(ndjsonFile)) {
      return { found: false, reason: 'ndjson file missing' };
    }
    const content = await readFile(ndjsonFile, 'utf8');
    const lines = content.trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]?.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && parsed.layout && parsed.schemaVersion) {
          return { found: true, snapshot: parsed };
        }
      } catch {
        continue;
      }
    }
    return { found: false, reason: 'no valid snapshot lines' };
  } catch (error) {
    return {
      found: false,
      reason: error instanceof Error ? error.message : 'read failure'
    };
  }
};

const parseMysqlPayload = (rawPayload) => {
  let payload = rawPayload;
  if (Buffer.isBuffer(payload)) {
    payload = payload.toString('utf8');
  }
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'payload parse failed'
      };
    }
  }
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'payload not object' };
  }
  return { ok: true, payload };
};

const readLatestMysqlSnapshot = async () => {
  if (!mysqlConfigured) {
    return { found: false, reason: 'mysql config missing' };
  }
  const pool = createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password || undefined,
    database: mysqlConfig.database,
    connectionLimit: 2,
    waitForConnections: true,
    enableKeepAlive: true
  });

  try {
    const [rows] = await pool.query(
      `SELECT tsUtc, payload FROM ${mysqlTable} ORDER BY id DESC LIMIT 1`
    );
    if (!rows || rows.length === 0) {
      return { found: false, reason: 'no rows' };
    }
    const row = rows[0];
    const parsedPayload = parseMysqlPayload(row.payload);
    if (!parsedPayload.ok) {
      return { found: false, reason: parsedPayload.reason };
    }

    return {
      found: true,
      snapshot: { tsUtc: row.tsUtc, payload: parsedPayload.payload }
    };
  } catch (error) {
    return {
      found: false,
      reason: error instanceof Error ? error.message : 'query failed'
    };
  } finally {
    try {
      await pool.end();
    } catch (error) {
      console.error('Failed to close MySQL pool:', error);
    }
  }
};

const removeInvalidLines = async () => {
  try {
    if (!fs.existsSync(ndjsonFile)) {
      return { removed: false, reason: 'ndjson file missing' };
    }
    const content = await readFile(ndjsonFile, 'utf8');
    const lines = content.split(/\r?\n/);
    const trimmed = lines.filter((line) => line.trim().length > 0);
    if (trimmed.length === 0) {
      return { removed: false, reason: 'ndjson empty' };
    }
    const nextLines = trimmed.filter((line) => line.trim() !== 'not-json');
    if (nextLines.length === trimmed.length) {
      return { removed: false, reason: 'no invalid line' };
    }
    const nextContent = nextLines.length ? `${nextLines.join('\n')}\n` : '';
    await writeFile(ndjsonFile, nextContent, 'utf8');
    return { removed: true };
  } catch (error) {
    return {
      removed: false,
      reason: error instanceof Error ? error.message : 'cleanup failed'
    };
  }
};

const comparePanels = (expectedPanels, actualPanels) => {
  const mismatches = [];
  for (const [panelId, expected] of Object.entries(expectedPanels)) {
    const actual = actualPanels?.[panelId];
    if (!actual) {
      mismatches.push({ panelId, reason: 'missing panel' });
      continue;
    }
    const fields = ['visible', 'collapsed', 'x', 'y', 'w', 'h'];
    for (const field of fields) {
      if (actual[field] !== expected[field]) {
        mismatches.push({
          panelId,
          field,
          expected: expected[field],
          actual: actual[field]
        });
      }
    }
  }
  return mismatches;
};

const run = async () => {
  let preflightCleanup = { skipped: true, removed: false };
  if (adapter === 'ndjson') {
    const cleanup = await removeInvalidLines();
    preflightCleanup = { skipped: false, ...cleanup };
  }

  if (shouldSpawnBackend) {
    childProcess = startBackend();
    backendReady = await waitForServer();
    if (!backendReady) {
      console.error('Backend did not become ready in time');
    }
  }

  const apiHealth = await fetchJson('/api/health');
  const initialLayout = await fetchJson('/api/ui/layout');

  const marker = Math.max(0, Math.min(9, Math.floor(Date.now() % 10)));
  const testPanels = {
    health: { visible: true, collapsed: false, x: 1 + marker, y: 0, w: 3, h: 8 },
    secondary: { visible: true, collapsed: false, x: 4 + marker, y: 0, w: 3, h: 8 }
  };

  const replaceResponse = await fetchJsonWithOptions('/api/ui/layout', {
    method: 'POST',
    body: { panels: testPanels }
  });

  const afterReplace = await fetchJson('/api/ui/layout');
  const replaceMismatches = comparePanels(testPanels, afterReplace?.body?.panels);

  const invalidMissingPanels = await fetchJsonWithOptions('/api/ui/layout', {
    method: 'PATCH',
    body: {}
  });

  const invalidPanelShape = await fetchJsonWithOptions('/api/ui/layout', {
    method: 'PATCH',
    body: { panels: { health: { visible: true } } }
  });

  const validation = {
    missingPanelsRejected:
      (invalidMissingPanels.status ?? 0) >= 400 || invalidMissingPanels.ok === false,
    invalidShapeRejected:
      (invalidPanelShape.status ?? 0) >= 400 || invalidPanelShape.ok === false
  };

  let ndjsonCheck = { skipped: true, reason: 'adapter not ndjson' };
  let appendedInvalidLine = false;
  let mysqlCheck = { skipped: true, reason: 'adapter not mysql', matches: false };

  if (adapter === 'ndjson') {
    const snapshotResult = await readLatestNdjsonSnapshot();
    const snapshot = snapshotResult.snapshot;
    const snapshotPanels = snapshot?.layout?.panels;
    const snapshotMismatches = comparePanels(testPanels, snapshotPanels);
    ndjsonCheck = {
      skipped: false,
      file: ndjsonFile,
      found: snapshotResult.found,
      schemaVersion: snapshot?.schemaVersion ?? null,
      mismatches: snapshotMismatches,
      matches: snapshotResult.found && snapshotMismatches.length === 0
    };

    if (snapshotResult.found) {
      try {
        await appendFile(ndjsonFile, 'not-json\n', 'utf8');
        appendedInvalidLine = true;
      } catch {
        appendedInvalidLine = false;
      }
    }
  }

  if (adapter === 'mysql') {
    const snapshotResult = await readLatestMysqlSnapshot();
    const payload = snapshotResult.snapshot?.payload;
    const snapshotPanels = payload?.layout?.panels;
    const snapshotMismatches = snapshotResult.found
      ? comparePanels(testPanels, snapshotPanels)
      : [];
    const schemaVersion = payload?.schemaVersion ?? null;
    mysqlCheck = {
      skipped: false,
      configured: mysqlConfigured,
      found: snapshotResult.found,
      reason: snapshotResult.reason ?? null,
      schemaVersion,
      mismatches: snapshotMismatches,
      matches:
        snapshotResult.found &&
        snapshotMismatches.length === 0 &&
        schemaVersion === 1
    };
  }

  let restartCheck = { skipped: true, reason: 'restart disabled or backend not spawned' };
  let invalidLineCleanup = { skipped: true, removed: false };

  if (shouldSpawnBackend && runRestartCheck && backendReady) {
    await stopBackend(childProcess);
    childProcess = startBackend();
    backendReady = await waitForServer();

    const afterRestart = await fetchJson('/api/ui/layout');
    const restartMismatches = comparePanels(testPanels, afterRestart?.body?.panels);
    restartCheck = {
      skipped: false,
      backendReady,
      appendedInvalidLine,
      mismatches: restartMismatches,
      matches: restartMismatches.length === 0,
      layout: afterRestart
    };
  }

  if (appendedInvalidLine) {
    const cleanup = await removeInvalidLines();
    invalidLineCleanup = { skipped: false, ...cleanup };
  }

  let restoreResult = { skipped: true, reason: 'initial layout missing' };
  if (initialLayout?.ok && initialLayout?.body?.panels) {
    const restoreResponse = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'POST',
      body: { panels: initialLayout.body.panels }
    });
    restoreResult = { skipped: false, response: restoreResponse };
  }

  const payload = {
    test: '03_infra_persist/00_ui_layout_persist',
    baseUrl,
    adapter,
    timestampUtc: new Date().toISOString(),
    backend: shouldSpawnBackend
      ? {
          ready: backendReady,
          exit: backendExit,
          stdout: backendLogs.stdout,
          stderr: backendLogs.stderr
        }
      : { ready: backendReady, skipped: true },
    results: {
      apiHealth,
      initialLayout,
      replaceResponse,
      afterReplace,
      replaceMismatches,
      validation,
      ndjsonCheck,
      mysqlCheck,
      restartCheck,
      invalidLineCleanup,
      preflightCleanup,
      restoreResult
    }
  };

  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Smoke test complete. Result written to ${resultPath}`);

  const replaceOk = replaceMismatches.length === 0 && replaceResponse.ok;
  const validationOk = validation.missingPanelsRejected && validation.invalidShapeRejected;
  const ndjsonOk =
    adapter !== 'ndjson' || (ndjsonCheck.found && ndjsonCheck.matches && ndjsonCheck.schemaVersion === 1);
  const mysqlOk = adapter !== 'mysql' || mysqlCheck.matches === true;
  const restartOk =
    restartCheck.skipped || restartCheck.matches === true;

  if (!replaceOk || !validationOk || !ndjsonOk || !mysqlOk || !restartOk) {
    console.error('Smoke test validation failed.');
    process.exitCode = 1;
  }

  if (shouldSpawnBackend) {
    await stopBackend(childProcess);
    childProcess = null;
  }
};

await run();
