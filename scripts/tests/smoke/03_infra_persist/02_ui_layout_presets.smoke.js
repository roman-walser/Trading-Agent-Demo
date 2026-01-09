// scripts/tests/smoke/03_infra_persist/02_ui_layout_presets.smoke.js
import { spawn, spawnSync } from 'child_process';
import { mkdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..');
const resultPath = path.join(__dirname, '02_ui_layout_presets.smoke.result.json');
const port = process.env.PORT ?? '3000';
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${port}`;
const shouldSpawnBackend = process.env.SMOKE_SPAWN_BACKEND !== 'false';
const runUi = process.env.SMOKE_UI !== 'false';
const headless = process.env.SMOKE_UI_HEADLESS !== 'false';
let backendLogs = { stdout: '', stderr: '' };
let backendExit = null;
let backendReady = true;
let childProcess = null;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const startupTimeoutMs = toNumber(process.env.SMOKE_STARTUP_TIMEOUT_MS, 15000);
const startupIntervalMs = toNumber(process.env.SMOKE_STARTUP_INTERVAL_MS, 250);

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

const hasFrontendBuild = async () => {
  const indexPath = path.join(rootDir, 'dist', 'frontend', 'index.html');
  try {
    const stats = await stat(indexPath);
    return stats.isFile();
  } catch {
    return false;
  }
};

const runApiSmoke = async () => {
  const result = {
    skipped: false,
    reason: null,
    steps: {}
  };

  if (!backendReady) {
    return { ...result, skipped: true, reason: 'backend not ready' };
  }

  const initial = await fetchJson('/api/ui/layouts');
  result.steps.initial = initial;

  const layoutSnapshot = await fetchJson('/api/ui/layout');
  result.steps.layoutSnapshot = layoutSnapshot;

  const uniqueTag = Date.now();
  const createName = `Smoke preset ${uniqueTag}`;
  const renameName = `Smoke preset ${uniqueTag} renamed`;

  const createResponse = await fetchJsonWithOptions('/api/ui/layouts', {
    method: 'POST',
    body: {
      name: createName,
      snapshot: layoutSnapshot.body
    }
  });
  result.steps.create = createResponse;

  const createdPreset = createResponse?.body?.preset;
  const presetId = createdPreset?.id ?? null;

  let renameResponse = null;
  let deleteResponse = null;
  let finalList = null;

  if (presetId) {
    renameResponse = await fetchJsonWithOptions(`/api/ui/layouts/${presetId}`, {
      method: 'PATCH',
      body: { name: renameName }
    });
    deleteResponse = await fetchJsonWithOptions(`/api/ui/layouts/${presetId}`, {
      method: 'DELETE'
    });
    finalList = await fetchJson('/api/ui/layouts');
  }

  result.steps.rename = renameResponse;
  result.steps.delete = deleteResponse;
  result.steps.finalList = finalList;

  const createdOk = createResponse.ok && Boolean(presetId);
  const renamedOk = renameResponse?.ok === true;
  const deletedOk = deleteResponse?.ok === true;
  const removed =
    finalList?.ok === true &&
    !(finalList.body?.layouts ?? []).some((entry) => entry.id === presetId);

  result.steps.validation = {
    createdOk,
    renamedOk,
    deletedOk,
    removed,
    ok: createdOk && renamedOk && deletedOk && removed
  };

  return result;
};

const runUiSmoke = async () => {
  const result = {
    skipped: false,
    reason: null,
    steps: {}
  };

  if (!backendReady) {
    return { ...result, skipped: true, reason: 'backend not ready' };
  }

  if (!runUi) {
    return { ...result, skipped: true, reason: 'SMOKE_UI disabled' };
  }

  const buildReady = await hasFrontendBuild();
  if (!buildReady) {
    return { ...result, skipped: true, reason: 'dist/frontend/index.html missing' };
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (error) {
    return {
      ...result,
      skipped: true,
      reason: error instanceof Error ? error.message : 'playwright not available'
    };
  }

  const browser = await playwright.chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  try {
    const uniqueTag = Date.now();
    const createName = `UI preset ${uniqueTag}`;
    const renameName = `UI preset ${uniqueTag} renamed`;

    const layoutMenuButton = page.getByRole('button', { name: 'Layout menu' });
    const layoutsMenuButton = page.getByRole('button', { name: 'Layouts menu' });
    const newNameInput = page.getByPlaceholder('New layout name');
    const renameInput = page.getByPlaceholder('Rename layout');

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('.panel-drag-handle').first().waitFor({ state: 'visible', timeout: 15000 });
    await layoutMenuButton.waitFor({ state: 'visible', timeout: 5000 });

    const expanded = await layoutMenuButton.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await layoutMenuButton.click();
    }
    await layoutsMenuButton.waitFor({ state: 'visible', timeout: 5000 });
    await layoutsMenuButton.click();
    await newNameInput.waitFor({ state: 'visible', timeout: 5000 });

    await newNameInput.fill(createName);
    await page.getByRole('button', { name: 'Save current' }).click();

    const presetButton = page.getByRole('button', { name: createName, exact: true });
    await presetButton.waitFor({ state: 'visible', timeout: 5000 });

    await page.getByRole('button', { name: `Rename ${createName}`, exact: true }).click();
    await renameInput.waitFor({ state: 'visible', timeout: 5000 });
    await renameInput.fill(renameName);
    const renameCard = renameInput.locator('..');
    await renameCard.getByRole('button', { name: 'Save', exact: true }).click();

    const renamedButton = page.getByRole('button', { name: renameName, exact: true });
    await renamedButton.waitFor({ state: 'visible', timeout: 5000 });

    await page.getByRole('button', { name: `Delete ${renameName}`, exact: true }).click();
    await renamedButton.waitFor({ state: 'hidden', timeout: 5000 });

    result.steps.flow = {
      created: true,
      renamed: true,
      deleted: true
    };
  } catch (error) {
    result.steps.flow = {
      created: false,
      renamed: false,
      deleted: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await browser.close();
  }

  return result;
};

const run = async () => {
  if (shouldSpawnBackend) {
    childProcess = startBackend();
    backendReady = await waitForServer();
    if (!backendReady) {
      console.error('Backend did not become ready in time');
    }
  }

  const apiHealth = await fetchJson('/api/health');
  const apiSmoke = await runApiSmoke();
  const uiSmoke = await runUiSmoke();

  const payload = {
    test: '03_infra_persist/02_ui_layout_presets',
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
      apiHealth,
      apiSmoke,
      uiSmoke
    }
  };

  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Smoke test complete. Result written to ${resultPath}`);

  const apiOk = payload.results.apiSmoke?.steps?.validation?.ok;
  const uiOk = payload.results.uiSmoke?.steps?.flow?.deleted === true;
  const hasApi = payload.results.apiSmoke && !payload.results.apiSmoke.skipped;
  const hasUi = payload.results.uiSmoke && !payload.results.uiSmoke.skipped;

  if ((hasApi && apiOk === false) || (hasUi && uiOk === false)) {
    console.error('Smoke test validation failed.');
    process.exitCode = 1;
  }

  if (shouldSpawnBackend) {
    await stopBackend(childProcess);
    childProcess = null;
  }
};

await run();
