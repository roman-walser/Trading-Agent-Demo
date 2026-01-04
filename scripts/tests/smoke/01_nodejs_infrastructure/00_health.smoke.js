// scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.js
import { spawn } from 'child_process';
import { mkdir, readdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';
import { io } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..');
const resultPath = path.join(__dirname, '00_health.smoke.result.json');
const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const port = process.env.PORT ?? '3000';
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${port}`;
const wsPath = process.env.WS_PATH ?? '/ws';
const shouldSpawnBackend = process.env.SMOKE_SPAWN_BACKEND !== 'false';
const startupTimeoutMs = toNumber(process.env.SMOKE_STARTUP_TIMEOUT_MS, 15000);
const startupIntervalMs = toNumber(process.env.SMOKE_STARTUP_INTERVAL_MS, 250);

let backendLogs = { stdout: '', stderr: '' };
let backendExit = null;
let childProcess = null;

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

const fetchText = async (relativePath) => {
  try {
    const response = await fetch(`${baseUrl}${relativePath}`);
    const text = await response.text();
    return {
      path: relativePath,
      status: response.status,
      ok: response.ok,
      length: text.length
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

const startBackend = () => {
  backendLogs = { stdout: '', stderr: '' };
  backendExit = null;
  const cleanupMode = process.env.NODE_CLEANUP_MODE ?? 'kill';
  const child = spawn(process.execPath, ['--import', 'tsx', 'backend/index.ts'], {
    cwd: rootDir,
    env: { ...process.env, PORT: port, NODE_CLEANUP_MODE: cleanupMode },
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
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (backendExit) {
      return false;
    }
    const result = await fetchJson('/health');
    if (result.ok) return true;
    await wait(startupIntervalMs);
  }
  return false;
};

const validateHealthShape = (response) => {
  const body = response?.body ?? {};
  const ok = body.ok === true;
  const serverTimeValid = typeof body.serverTimeUtc === 'string' && body.serverTimeUtc.length > 0;

  return {
    ok,
    serverTimeValid,
    valid: ok && serverTimeValid
  };
};

const checkWebSocket = async () => {
  const startTs = Date.now();
  try {
    const socket = io(baseUrl, { path: wsPath, transports: ['websocket'], timeout: 3000 });

    const result = await Promise.race([
      new Promise((resolve) => {
        socket.on('connect', () => resolve({ connected: true, id: socket.id }));
      }),
      new Promise((resolve) => {
        socket.on('connect_error', (err) =>
          resolve({ connected: false, error: err?.message ?? 'connect_error' })
        );
        setTimeout(() => resolve({ connected: false, error: 'timeout' }), 3000);
      })
    ]);

    socket.disconnect();
    return { ...result, durationMs: Date.now() - startTs };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'unknown error',
      durationMs: Date.now() - startTs
    };
  }
};

const findAssetPath = async () => {
  const assetsDir = path.join(rootDir, 'dist', 'frontend', 'assets');
  try {
    const stats = await stat(assetsDir);
    if (!stats.isDirectory()) return null;
    const files = await readdir(assetsDir);
    const asset = files.find((f) => f.endsWith('.css')) ?? files.find((f) => f.endsWith('.js'));
    return asset ? `/assets/${asset}` : null;
  } catch {
    return null;
  }
};

const run = async () => {
  let backendReady = true;

  if (shouldSpawnBackend) {
    childProcess = startBackend();
    backendReady = await waitForServer();
    if (!backendReady) {
      console.error('Backend did not become ready in time');
    }
  }

  const health = await fetchJson('/health');
  const apiHealth = await fetchJson('/api/health');
  const healthValidation = {
    health: validateHealthShape(health),
    apiHealth: validateHealthShape(apiHealth)
  };

  const websocket = await checkWebSocket();

  const frontendRoot = await fetchText('/');
  const assetPath = await findAssetPath();
  const assetCheck = assetPath ? await fetchText(assetPath) : { skipped: true, reason: 'no built asset found' };

  const payload = {
    test: '01_nodejs_infrastructure/00_health',
    baseUrl,
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
      health,
      apiHealth,
      validation: healthValidation,
      websocket,
      frontend: {
        root: frontendRoot,
        asset: assetCheck,
        assetPath
      }
    }
  };

  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Smoke test complete. Result written to ${resultPath}`);

  if (shouldSpawnBackend) {
    await stopBackend(childProcess);
    childProcess = null;
  }
};

await run();
