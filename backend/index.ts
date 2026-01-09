// backend/index.ts
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { appConfig } from './config/index.js';
import { closeUiLayoutAdapter } from './infra/persist/uiLayout.repo.js';
import { createHttpServer } from './server/http/index.js';
import { attachWebsocketServer } from './server/ws/index.js';
import { hydrateUiLayoutFromPersistence } from './state-services/ui.service.js';

const app = createHttpServer();
const io = attachWebsocketServer(app);

const start = async (): Promise<void> => {
  try {
    await ensureCleanNodeStartup();
    const hydratedLayout = await hydrateUiLayoutFromPersistence();
    if (hydratedLayout) {
      const panelCount = Object.keys(hydratedLayout.panels ?? {}).length;
      console.log(`UI layout hydrated from persistence (${panelCount} panel(s)).`);
    } else {
      console.log('UI layout persistence is empty.');
    }
    console.log('Starting server...');
    await app.listen({ port: appConfig.http.port, host: '0.0.0.0' });
    console.log(`Server started on http://0.0.0.0:${appConfig.http.port}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Server failed to start: ${message}`);
    process.exit(1);
  }
};

const shutdown = async (signal?: string): Promise<void> => {
  const suffix = signal ? ` (${signal})` : '';
  console.log(`Shutting down server${suffix}...`);

  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });

  await closeUiLayoutAdapter();
  await app.close();
  process.exit(0);
};

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    void shutdown(signal);
  });
});

void start();

async function ensureCleanNodeStartup(): Promise<void> {
  console.log('Preparing cleanup...');

  const cleanupModeRaw = (process.env.NODE_CLEANUP_MODE ?? 'prompt').trim().toLowerCase();
  const allowedModes = new Set(['prompt', 'skip', 'kill']);
  const cleanupMode = allowedModes.has(cleanupModeRaw) ? cleanupModeRaw : 'prompt';
  const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  if (process.env.NODE_CLEANUP_MODE && cleanupMode !== cleanupModeRaw) {
    console.log(`Unknown NODE_CLEANUP_MODE "${cleanupModeRaw}", defaulting to "prompt".`);
  }

  if (cleanupMode === 'skip') {
    console.log('Cleanup skipped (NODE_CLEANUP_MODE=skip).');
    return;
  }

  if (!isInteractive && cleanupMode === 'prompt') {
    console.log('Cleanup skipped (non-interactive session).');
    return;
  }

  const pids = getNodeProcessPids();
  const protectedPids = getProtectedPids();
  const filtered = pids.filter((pid) => !protectedPids.has(pid));

  if (filtered.length === 0) {
    console.log('Cleanup ok. No other node processes found.');
    return;
  }

  const uniquePids = Array.from(new Set(filtered));
  console.log(`Found ${uniquePids.length} node process(es).`);

  if (cleanupMode === 'prompt') {
    const shouldKill = await promptYesNo('Kill these processes? (y/N): ');
    if (!shouldKill) {
      console.log('Cleanup skipped by user choice.');
      return;
    }
  }

  uniquePids.forEach((pid) => {
    killProcess(pid);
  });

  console.log(`Cleanup ok. Killed ${uniquePids.length} process(es).`);

  function getNodeProcessPids(): string[] {
    return process.platform === 'win32' ? getWindowsNodePids() : getPosixNodePids();
  }

  function getProtectedPids(): Set<string> {
    const protectedPids = new Set<string>();
    const direct = [process.pid, process.ppid].filter((pid) => Number.isInteger(pid));
    direct.forEach((pid) => protectedPids.add(String(pid)));

    const ancestors = getAncestorPids(process.pid);
    ancestors.forEach((pid) => protectedPids.add(pid));

    return protectedPids;
  }

  function getAncestorPids(pid: number): string[] {
    const ancestors: string[] = [];
    const seen = new Set<number>([pid]);
    let current = pid;

    while (true) {
      const parentPid = getParentPid(current);
      if (!parentPid || parentPid <= 0 || seen.has(parentPid)) {
        break;
      }
      ancestors.push(String(parentPid));
      seen.add(parentPid);
      current = parentPid;
    }

    return ancestors;
  }

  function getParentPid(pid: number): number | null {
    return process.platform === 'win32' ? getWindowsParentPid(pid) : getPosixParentPid(pid);
  }

  function getWindowsParentPid(pid: number): number | null {
    const result = runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").ParentProcessId`,
    ], 'pipe', true);
    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.trim();
      if (detail) {
        console.warn(`Cleanup helper failed (powershell): ${detail}`);
      }
      return null;
    }

    const output = result.stdout.trim();
    if (!output) {
      return null;
    }

    const parsed = Number.parseInt(output, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function getPosixParentPid(pid: number): number | null {
    const result = runCommand('ps', ['-p', String(pid), '-o', 'ppid='], 'pipe', true);
    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.trim();
      if (detail) {
        console.warn(`Cleanup helper failed (ps ppid): ${detail}`);
      }
      return null;
    }

    const output = result.stdout.trim();
    if (!output) {
      return null;
    }

    const parsed = Number.parseInt(output, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function getWindowsNodePids(): string[] {
    const result = runCommand('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'], 'pipe', true);
    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.trim();
      if (detail) {
        console.warn(`Cleanup helper failed (tasklist): ${detail}`);
      }
      return [];
    }

    const lines = result.stdout.split(/\r?\n/).map((line) => line.trim());
    if (lines.some((line) => line.startsWith('INFO:'))) {
      return [];
    }

    const pids: string[] = [];
    const quote = String.fromCharCode(34);
    for (const line of lines) {
      if (!line || !line.startsWith(quote)) {
        continue;
      }
      const body = line.endsWith(quote) ? line.slice(1, -1) : line.slice(1);
      const parts = body.split(`${quote},${quote}`);
      const pid = parts[1];
      if (pid) {
        pids.push(pid);
      }
    }

    return pids;
  }

  function getPosixNodePids(): string[] {
    const result = runCommand('ps', ['-A', '-o', 'pid=', '-o', 'comm='], 'pipe', true);
    if (result.error || result.status !== 0) {
      const detail = result.error?.message ?? result.stderr?.trim();
      if (detail) {
        console.warn(`Cleanup helper failed (ps list): ${detail}`);
      }
      return [];
    }

    const pids: string[] = [];
    const lines = result.stdout.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const match = trimmed.match(/^(\d+)\s+(\S+)/);
      if (!match) {
        continue;
      }
      const pid = match[1];
      const command = match[2].toLowerCase();
      if (command === 'node' || command === 'nodejs') {
        pids.push(pid);
      }
    }

    return pids;
  }

  function promptYesNo(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (answer) => {
        rl.close();
        const normalized = String(answer ?? '').trim().toLowerCase();
        resolve(normalized.startsWith('y'));
      });
    });
  }

  function killProcess(pid: string): void {
    if (process.platform === 'win32') {
      const result = runCommand('taskkill', ['/PID', pid, '/F']);
      if (result.status !== 0) {
        const detail = result.stderr.trim() || result.stdout.trim();
        console.error(
          `Cleanup failed to kill process ${pid}${detail ? `: ${detail}` : ''}`
        );
        process.exit(result.status ?? 1);
      }
      return;
    }

    const result = runCommand('kill', ['-9', pid]);
    if (result.status !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim();
      console.error(`Cleanup failed to kill process ${pid}${detail ? `: ${detail}` : ''}`);
      process.exit(result.status ?? 1);
    }
  }

  function runCommand(
    command: string,
    args: string[],
    stdio: 'pipe' | 'inherit' = 'pipe',
    allowFailure = false
  ) {
    const result = spawnSync(command, args, { encoding: 'utf8', stdio });
    if (result.error) {
      if (allowFailure) {
        return result;
      }
      console.error(result.error.message);
      process.exit(1);
    }
    return result;
  }
}
