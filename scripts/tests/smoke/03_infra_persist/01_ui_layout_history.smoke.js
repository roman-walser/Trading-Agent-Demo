// scripts/tests/smoke/03_infra_persist/01_ui_layout_history.smoke.js
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  canGoBack,
  canGoForward,
  getUiLayoutSnapshot,
  goBack,
  goForward,
  hydrateUiLayoutFromSnapshot,
  recordUiLayoutHistory
} from '../../../../frontend/state/store.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultPath = path.join(__dirname, '01_ui_layout_history.smoke.result.json');

const buildSnapshot = (offset, lastUpdatedUtc) => ({
  panels: {
    health: { visible: true, collapsed: false, x: 1 + offset, y: 0, w: 3, h: 8 },
    secondary: { visible: true, collapsed: false, x: 4 + offset, y: 0, w: 3, h: 8 }
  },
  lastUpdatedUtc
});

const comparePanels = (expectedPanels, actualPanels) => {
  const mismatches = [];
  const ids = new Set([
    ...Object.keys(expectedPanels ?? {}),
    ...Object.keys(actualPanels ?? {})
  ]);
  for (const id of ids) {
    const expected = expectedPanels?.[id];
    const actual = actualPanels?.[id];
    if (!expected || !actual) {
      mismatches.push({ panelId: id, reason: 'missing panel' });
      continue;
    }
    const fields = ['visible', 'collapsed', 'x', 'y', 'w', 'h'];
    for (const field of fields) {
      if (expected[field] !== actual[field]) {
        mismatches.push({
          panelId: id,
          field,
          expected: expected[field],
          actual: actual[field]
        });
      }
    }
  }
  return mismatches;
};

const layoutMatches = (expected, actual) =>
  comparePanels(expected?.panels ?? {}, actual?.panels ?? {}).length === 0;

const run = async () => {
  const snapshotA = buildSnapshot(0, '2026-01-06T00:00:00.000Z');
  const snapshotB = buildSnapshot(2, '2026-01-06T00:00:01.000Z');

  hydrateUiLayoutFromSnapshot(snapshotA);
  const initialSnapshot = getUiLayoutSnapshot();

  const initialBackAttempt = goBack();
  const initialChecks = {
    canGoBack: canGoBack(),
    canGoForward: canGoForward(),
    backReturnsNull: initialBackAttempt === null
  };

  recordUiLayoutHistory(initialSnapshot, snapshotB);
  const afterRecordSnapshot = getUiLayoutSnapshot();

  const afterRecordChecks = {
    canGoBack: canGoBack(),
    canGoForward: canGoForward(),
    layoutMatches: layoutMatches(snapshotB, afterRecordSnapshot)
  };

  const backSnapshot = goBack();
  const afterBackSnapshot = getUiLayoutSnapshot();

  const afterBackChecks = {
    canGoBack: canGoBack(),
    canGoForward: canGoForward(),
    returnedSnapshotMatches: layoutMatches(snapshotA, backSnapshot),
    layoutMatches: layoutMatches(snapshotA, afterBackSnapshot)
  };

  const forwardSnapshot = goForward();
  const afterForwardSnapshot = getUiLayoutSnapshot();

  const afterForwardChecks = {
    canGoBack: canGoBack(),
    canGoForward: canGoForward(),
    returnedSnapshotMatches: layoutMatches(snapshotB, forwardSnapshot),
    layoutMatches: layoutMatches(snapshotB, afterForwardSnapshot)
  };

  const checks = {
    initialCanGoBackFalse: initialChecks.canGoBack === false,
    initialCanGoForwardFalse: initialChecks.canGoForward === false,
    initialBackNull: initialChecks.backReturnsNull === true,
    afterRecordCanGoBackTrue: afterRecordChecks.canGoBack === true,
    afterRecordCanGoForwardFalse: afterRecordChecks.canGoForward === false,
    afterRecordLayoutMatches: afterRecordChecks.layoutMatches === true,
    afterBackCanGoForwardTrue: afterBackChecks.canGoForward === true,
    afterBackLayoutMatches: afterBackChecks.layoutMatches === true,
    afterForwardCanGoForwardFalse: afterForwardChecks.canGoForward === false,
    afterForwardLayoutMatches: afterForwardChecks.layoutMatches === true
  };

  const payload = {
    test: '03_infra_persist/01_ui_layout_history',
    timestampUtc: new Date().toISOString(),
    snapshots: {
      initial: initialSnapshot,
      afterRecord: afterRecordSnapshot,
      afterBack: afterBackSnapshot,
      afterForward: afterForwardSnapshot
    },
    results: {
      initialChecks,
      afterRecordChecks,
      afterBackChecks,
      afterForwardChecks
    },
    checks
  };

  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Smoke test complete. Result written to ${resultPath}`);

  const pass = Object.values(checks).every(Boolean);
  if (!pass) {
    console.error('Smoke test validation failed.');
    process.exitCode = 1;
  }
};

await run();
