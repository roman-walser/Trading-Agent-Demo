// scripts/tests/smoke/02_states/00_state_snapshot.smoke.js
import { spawn, spawnSync } from 'child_process';
import { mkdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..');
const resultPath = path.join(__dirname, '00_state_snapshot.smoke.result.json');
const port = process.env.PORT ?? '3000';
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${port}`;
const shouldSpawnBackend = process.env.SMOKE_SPAWN_BACKEND !== 'false';
const runUi = process.env.SMOKE_UI !== 'false';
const panelId = process.env.SMOKE_UI_PANEL_ID ?? 'health';
const panelLabel = process.env.SMOKE_UI_PANEL_LABEL ?? 'Health';
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

const dragOffsetX = toNumber(process.env.SMOKE_UI_DRAG_OFFSET_X, 260);
const dragOffsetY = toNumber(process.env.SMOKE_UI_DRAG_OFFSET_Y, 0);

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

const hasFrontendBuild = async () => {
  const indexPath = path.join(rootDir, 'dist', 'frontend', 'index.html');
  try {
    const stats = await stat(indexPath);
    return stats.isFile();
  } catch {
    return false;
  }
};

const waitForPanelState = async (predicate, timeoutMs = 5000, intervalMs = 250) => {
  const start = Date.now();
  let lastResponse = null;

  while (Date.now() - start < timeoutMs) {
    lastResponse = await fetchJson('/api/ui/layout');
    const panel = lastResponse?.body?.panels?.[panelId];
    if (panel && predicate(panel)) {
      return { matched: true, response: lastResponse };
    }
    await wait(intervalMs);
  }

  return { matched: false, response: lastResponse };
};

const runLayoutApiTests = async () => {
  const result = {
    skipped: false,
    reason: null,
    steps: {}
  };

  if (!backendReady) {
    return { ...result, skipped: true, reason: 'backend not ready' };
  }

  const initial = await fetchJson('/api/ui/layout');
  result.steps.initial = initial;

  if (!initial.ok) {
    return { ...result, skipped: true, reason: 'initial layout fetch failed' };
  }

  const initialPanels = initial?.body?.panels ?? {};
  const restorePayload = { panels: initialPanels };

  const baseHealth = {
    visible: true,
    collapsed: false,
    x: 0,
    y: 0,
    w: 3,
    h: 8
  };
  const secondary = {
    visible: true,
    collapsed: false,
    x: 3,
    y: 0,
    w: 3,
    h: 8
  };

  try {
    const replacePayload = { panels: { health: baseHealth, secondary } };
    const replaceResponse = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'POST',
      body: replacePayload
    });
    result.steps.replace = replaceResponse;

    const patchedHealth = {
      ...baseHealth,
      collapsed: true,
      x: 4,
      y: 1,
      w: 4,
      h: 6
    };

    const patchResponse = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'PATCH',
      body: { panels: { health: patchedHealth } }
    });
    const patchedSecondary = patchResponse?.body?.panels?.secondary;
    const mergeOk = Boolean(
      patchResponse.ok &&
        patchResponse?.body?.panels?.health &&
        patchedSecondary &&
        patchResponse.body.panels.health.x === patchedHealth.x &&
        patchResponse.body.panels.health.y === patchedHealth.y &&
        patchResponse.body.panels.health.w === patchedHealth.w &&
        patchResponse.body.panels.health.h === patchedHealth.h &&
        patchResponse.body.panels.health.collapsed === patchedHealth.collapsed &&
        patchedSecondary.x === secondary.x &&
        patchedSecondary.y === secondary.y &&
        patchedSecondary.w === secondary.w &&
        patchedSecondary.h === secondary.h &&
        patchedSecondary.visible === secondary.visible &&
        patchedSecondary.collapsed === secondary.collapsed
    );

    result.steps.patch = { ...patchResponse, mergeOk };

    const invalidMissingPanels = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'PATCH',
      body: {}
    });
    const invalidPanelShape = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'PATCH',
      body: { panels: { health: { visible: true } } }
    });

    result.steps.invalidMissingPanels = invalidMissingPanels;
    result.steps.invalidPanelShape = invalidPanelShape;
    const missingPanelsRejected =
      (invalidMissingPanels.status ?? 0) >= 400 || !invalidMissingPanels.ok;
    const invalidShapeRejected =
      (invalidPanelShape.status ?? 0) >= 400 || !invalidPanelShape.ok;

    result.steps.validation = {
      missingPanelsRejected,
      invalidShapeRejected,
      mergeOk,
      ok: missingPanelsRejected && invalidShapeRejected && mergeOk
    };
  } finally {
    const restore = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'POST',
      body: restorePayload
    });
    result.steps.restore = restore;
  }

  return result;
};

const runUiSmoke = async () => {
  const result = {
    skipped: false,
    reason: null,
    panelId,
    panelLabel,
    dragOffsetX,
    dragOffsetY,
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
    const cacheKey = 'ui-layout-cache';
    const seedGuardKey = 'ui-layout-cache-smoke-seeded';
    const stalePanelId = 'stale-panel';
    const seededHealth = {
      visible: true,
      collapsed: false,
      x: 0,
      y: 0,
      w: 3,
      h: 8
    };
    const stalePanel = {
      visible: true,
      collapsed: false,
      x: 6,
      y: 0,
      w: 3,
      h: 8
    };
    const staleCacheSeed = {
      panels: { [panelId]: seededHealth, [stalePanelId]: stalePanel },
      lastUpdatedUtc: null
    };
    const staleServerReset = await fetchJsonWithOptions('/api/ui/layout', {
      method: 'POST',
      body: { panels: {} }
    });
    result.steps.stalePanelSeed = {
      stalePanelId,
      serverReset: staleServerReset,
      cacheSeed: staleCacheSeed
    };

    await page.addInitScript((payload) => {
      try {
        const alreadySeeded = window.sessionStorage.getItem(payload.guardKey);
        if (alreadySeeded) return;
        window.localStorage.setItem(payload.key, JSON.stringify(payload.snapshot));
        window.sessionStorage.setItem(payload.guardKey, '1');
      } catch {
        /* ignore */
      }
    }, { key: cacheKey, snapshot: staleCacheSeed, guardKey: seedGuardKey });

    const layoutResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/ui/layout') && response.request().method() === 'GET',
        { timeout: 15000 }
      )
      .catch(() => null);

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('.panel-drag-handle').first().waitFor({ state: 'visible', timeout: 15000 });

    const readLayoutCache = async () =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return { parseError: true };
        }
      }, cacheKey);

    const waitForCacheWithoutPanel = async (targetId, timeoutMs = 5000, intervalMs = 250) => {
      const start = Date.now();
      let lastSnapshot = null;

      while (Date.now() - start < timeoutMs) {
        lastSnapshot = await readLayoutCache();
        const hasPanel = Boolean(lastSnapshot?.panels && targetId in lastSnapshot.panels);
        if (!hasPanel) {
          return { matched: true, snapshot: lastSnapshot };
        }
        await wait(intervalMs);
      }

      return { matched: false, snapshot: lastSnapshot };
    };

    await layoutResponsePromise;
    const staleCleanup = await waitForCacheWithoutPanel(stalePanelId);
    result.steps.stalePanelCleanup = {
      stalePanelId,
      matched: staleCleanup.matched,
      cache: staleCleanup.snapshot
    };

    const initialLayout = await fetchJson('/api/ui/layout');
    result.steps.initialLayout = initialLayout;

    const ensurePanelVisible = async (visible) => {
      const button = page.getByRole('button', { name: 'Panels' });
      const panelItem = page.locator('label', { hasText: panelLabel });
      const isItemVisible = await panelItem.isVisible();
      if (!isItemVisible) {
        await button.click();
      }
      await panelItem.waitFor({ state: 'visible', timeout: 5000 });
      const checkbox = panelItem.locator('input[type="checkbox"]');
      const checked = await checkbox.isChecked();
      if (checked !== visible) {
        await checkbox.click();
      }
      const waitResult = await waitForPanelState((panel) => panel.visible === visible);
      return {
        requested: visible,
        checkedBefore: checked,
        applied: checked !== visible,
        matched: waitResult.matched,
        layout: waitResult.response
      };
    };

    const dragStep = async () => {
      const handle = page.locator('.panel-drag-handle').first();
      const beforeBox = await handle.boundingBox();
      const beforeLayout = await fetchJson('/api/ui/layout');
      const startX = beforeLayout?.body?.panels?.[panelId]?.x ?? 0;

      if (!beforeBox) {
        return { moved: false, error: 'Drag handle not visible', startX };
      }

      const centerX = beforeBox.x + beforeBox.width / 2;
      const centerY = beforeBox.y + beforeBox.height / 2;
      const previewOffsetX =
        dragOffsetX === 0
          ? 12
          : Math.sign(dragOffsetX) * Math.max(12, Math.round(Math.abs(dragOffsetX) * 0.2));
      const previewOffsetY =
        dragOffsetY === 0
          ? 0
          : Math.sign(dragOffsetY) * Math.max(4, Math.round(Math.abs(dragOffsetY) * 0.2));

      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + previewOffsetX, centerY + previewOffsetY, { steps: 4 });
      const placeholderLocator = page.locator('.react-grid-item.react-grid-placeholder');
      const placeholderVisible = await placeholderLocator.isVisible();
      await page.mouse.move(
        centerX + dragOffsetX,
        centerY + dragOffsetY,
        { steps: 12 }
      );
      await page.mouse.up();

      const waitResult = await waitForPanelState((panel) => panel.x !== startX);
      const afterLayout = waitResult.response ?? (await fetchJson('/api/ui/layout'));
      const endX = afterLayout?.body?.panels?.[panelId]?.x ?? null;
      const afterBox = await handle.boundingBox();
      const movedPx =
        beforeBox && afterBox ? Math.round(afterBox.x - beforeBox.x) : null;
      const moved = typeof movedPx === 'number' ? Math.abs(movedPx) >= 10 : false;

      return {
        startX,
        endX,
        moved,
        movedPx,
        matched: waitResult.matched,
        placeholderVisible,
        beforeLayout,
        afterLayout
      };
    };

    const collapseStep = async (collapsed) => {
      const toggle = page.locator('.panel-toggle').first();
      await toggle.click();
      const waitResult = await waitForPanelState((panel) => panel.collapsed === collapsed);
      const panelState = waitResult.response?.body?.panels?.[panelId];
      const heightOk = collapsed ? panelState?.h === 2 : true;
      return {
        collapsed,
        matched: waitResult.matched,
        height: panelState?.h ?? null,
        heightOk,
        layout: waitResult.response
      };
    };

    const waitForToggleLabel = async (locator, expected, timeoutMs = 5000, intervalMs = 200) => {
      const start = Date.now();
      let lastLabel = null;

      while (Date.now() - start < timeoutMs) {
        lastLabel = await locator.getAttribute('aria-label');
        if (lastLabel === expected) {
          return { matched: true, label: lastLabel };
        }
        await wait(intervalMs);
      }

      return { matched: false, label: lastLabel };
    };

    const rollbackStep = async () => {
      const toggle = page.locator('.panel-toggle').first();
      const labelBefore = await toggle.getAttribute('aria-label');

      if (!labelBefore) {
        return { skipped: true, reason: 'toggle missing' };
      }

      let intercepted = false;
      const handler = async (route) => {
        const request = route.request();
        if (request.method() === 'PATCH' && !intercepted) {
          intercepted = true;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'forced failure' })
          });
          return;
        }
        await route.continue();
      };

      await page.route('**/api/ui/layout', handler);

      let patchStatus = null;
      let labelAfter = null;
      let rollbackResult = { matched: false, label: null };

      try {
        await toggle.click();
        const response = await page
          .waitForResponse(
            (resp) =>
              resp.url().includes('/api/ui/layout') && resp.request().method() === 'PATCH',
            { timeout: 5000 }
          )
          .catch(() => null);
        patchStatus = response?.status() ?? null;
        rollbackResult = await waitForToggleLabel(toggle, labelBefore);
        labelAfter = rollbackResult.label;
      } finally {
        await page.unroute('**/api/ui/layout', handler);
      }

      let restored = false;
      if (!rollbackResult.matched) {
        await toggle.click();
        const restoreResult = await waitForToggleLabel(toggle, labelBefore);
        restored = restoreResult.matched;
        if (restoreResult.matched) {
          labelAfter = restoreResult.label;
        }
      }

      return {
        skipped: false,
        intercepted,
        patchStatus,
        labelBefore,
        labelAfter,
        rolledBack: rollbackResult.matched,
        restored
      };
    };

    result.steps.ensureVisible = await ensurePanelVisible(true);
    result.steps.rollbackOnPatchFailure = await rollbackStep();
    result.steps.drag = await dragStep();
    result.steps.collapse = await collapseStep(true);
    result.steps.expand = await collapseStep(false);
    result.steps.hide = await ensurePanelVisible(false);
    result.steps.show = await ensurePanelVisible(true);

    await page.locator('.panel-drag-handle').first().waitFor({ state: 'visible', timeout: 10000 });

    const beforeReload = await fetchJson('/api/ui/layout');
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.panel-drag-handle').first().waitFor({ state: 'visible', timeout: 10000 });
    const afterReload = await fetchJson('/api/ui/layout');
    const panelBefore = beforeReload?.body?.panels?.[panelId];
    const panelAfter = afterReload?.body?.panels?.[panelId];
    const preserved =
      panelBefore &&
      panelAfter &&
      ['visible', 'collapsed', 'x', 'y', 'w', 'h'].every(
        (key) => panelBefore[key] === panelAfter[key]
      );

    result.steps.reload = {
      preserved,
      beforeReload,
      afterReload
    };

    const stalePanelCleanupOk = result.steps.stalePanelCleanup?.matched === true;
    const rollbackOk = result.steps.rollbackOnPatchFailure?.rolledBack === true;
    result.steps.validation = {
      stalePanelCleanup: stalePanelCleanupOk,
      rollbackOnPatchFailure: rollbackOk,
      ok: stalePanelCleanupOk && rollbackOk
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
  const layoutApiTests = await runLayoutApiTests();
  const uiLayout = await fetchJson('/api/ui/layout');
  const uiSmoke = await runUiSmoke();

  const payload = {
    test: '02_states/00_state_snapshot',
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
      layoutApiTests,
      uiLayout,
      uiSmoke
    }
  };

  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Smoke test complete. Result written to ${resultPath}`);

  const layoutValidationOk = payload.results.layoutApiTests?.steps?.validation?.ok;
  const uiValidationOk = payload.results.uiSmoke?.steps?.validation?.ok;
  const hasUiSmoke = payload.results.uiSmoke && !payload.results.uiSmoke.skipped;
  const hasLayoutSmoke = payload.results.layoutApiTests && !payload.results.layoutApiTests.skipped;
  const failedUiValidation = hasUiSmoke && uiValidationOk === false;
  const failedLayoutValidation = hasLayoutSmoke && layoutValidationOk === false;

  if (failedUiValidation || failedLayoutValidation) {
    console.error('Smoke test validation failed.');
    process.exitCode = 1;
  }

  if (shouldSpawnBackend) {
    await stopBackend(childProcess);
    childProcess = null;
  }
};

await run();
