// backend/state-services/ui.service.ts
import { randomUUID } from 'node:crypto';
import { getUiLayoutState, mergeUiLayout, setUiLayoutState, type PanelLayout, type UiLayoutState } from '../states/ui.state.js';
import {
  loadUiLayoutHistory,
  loadUiLayoutPresets,
  loadUiLayoutSnapshot,
  persistUiLayoutPreset,
  persistUiLayoutSnapshot,
  renameUiLayoutPreset,
  deleteUiLayoutPreset,
  resetUiLayoutHistory
} from '../infra/persist/uiLayout.repo.js';

export type UpsertUiLayoutPayload = {
  panels: Record<string, PanelLayout>;
};

const LOG_PREFIX = '[state-services:ui]';
const utcNow = (): string => new Date().toISOString();
const normalizePresetName = (value: string): string => value.trim();
const normalizePresetKey = (value: string): string => normalizePresetName(value).toLowerCase();

const cloneLayout = (state: UiLayoutState): UiLayoutState => ({
  panels: { ...state.panels },
  lastUpdatedUtc: state.lastUpdatedUtc
});

const warnIfRapidUpdate = (previousUtc: string | null, nextUtc: string): void => {
  if (!previousUtc) return;
  const previousTime = Date.parse(previousUtc);
  const nextTime = Date.parse(nextUtc);
  if (!Number.isFinite(previousTime) || !Number.isFinite(nextTime)) return;
  const deltaMs = nextTime - previousTime;
  if (deltaMs >= 0 && deltaMs < 1000) {
    console.warn(`${LOG_PREFIX} Rapid layout update detected (last-write-wins).`, {
      previousUtc,
      nextUtc
    });
  }
};

const persistSnapshot = async (state: UiLayoutState): Promise<void> => {
  const persisted = await persistUiLayoutSnapshot(state);
  if (!persisted) {
    console.warn(`${LOG_PREFIX} Failed to persist UI layout snapshot.`);
  }
};

/**
 * Returns a defensive snapshot of the current UI layout.
 */
export const getUiLayoutSnapshot = (): UiLayoutState => getUiLayoutState();

/**
 * Returns recent UI layout snapshots for history navigation.
 */
export const getUiLayoutHistory = async (limit?: number): Promise<UiLayoutState[]> =>
  loadUiLayoutHistory(limit);

/**
 * Clears history while keeping the current layout as the latest snapshot.
 */
export const clearUiLayoutHistory = async (): Promise<UiLayoutState> => {
  const current = getUiLayoutState();
  const persisted = await resetUiLayoutHistory(current);
  if (!persisted) {
    console.warn(`${LOG_PREFIX} Failed to reset UI layout history.`);
  }
  return current;
};

/**
 * Hydrates UI layout state from persistence, if available.
 */
export const hydrateUiLayoutFromPersistence = async (): Promise<UiLayoutState | null> => {
  const snapshot = await loadUiLayoutSnapshot();
  if (!snapshot) {
    return null;
  }
  return setUiLayoutState(snapshot);
};

/**
 * Replaces the layout entirely.
 */
export const replaceUiLayout = async (payload: UpsertUiLayoutPayload): Promise<UiLayoutState> => {
  const updatedAtUtc = utcNow();
  const previous = getUiLayoutState();
  const nextState = setUiLayoutState({
    panels: { ...payload.panels },
    lastUpdatedUtc: updatedAtUtc
  });
  warnIfRapidUpdate(previous.lastUpdatedUtc, updatedAtUtc);
  await persistSnapshot(nextState);
  return nextState;
};

/**
 * Merges layout entries into the existing layout (idempotent per panel id).
 */
export const upsertUiLayout = async (payload: UpsertUiLayoutPayload): Promise<UiLayoutState> => {
  const updatedAtUtc = utcNow();
  const previous = getUiLayoutState();
  const nextState = mergeUiLayout(payload.panels, updatedAtUtc);
  warnIfRapidUpdate(previous.lastUpdatedUtc, updatedAtUtc);
  await persistSnapshot(nextState);
  return nextState;
};

export type UiLayoutPreset = {
  id: string;
  name: string;
  snapshot: UiLayoutState;
  createdUtc: string;
  updatedUtc: string;
};

type UiLayoutPresetResult =
  | { ok: true; preset: UiLayoutPreset }
  | { ok: false; reason: 'duplicate' | 'not_found' | 'persist_failed' };

/**
 * Lists saved layout presets.
 */
export const getUiLayoutPresets = async (): Promise<UiLayoutPreset[]> =>
  loadUiLayoutPresets();

/**
 * Creates a new saved layout preset.
 */
export const createUiLayoutPreset = async (
  name: string,
  snapshot: UiLayoutState
): Promise<UiLayoutPresetResult> => {
  const trimmed = normalizePresetName(name);
  const key = normalizePresetKey(trimmed);
  const existing = await loadUiLayoutPresets();
  if (existing.some((preset) => normalizePresetKey(preset.name) === key)) {
    return { ok: false, reason: 'duplicate' };
  }

  const now = utcNow();
  const preset: UiLayoutPreset = {
    id: randomUUID(),
    name: trimmed,
    snapshot: cloneLayout(snapshot),
    createdUtc: now,
    updatedUtc: now
  };

  const persisted = await persistUiLayoutPreset(preset);
  if (!persisted) {
    console.warn(`${LOG_PREFIX} Failed to persist layout preset.`);
    return { ok: false, reason: 'persist_failed' };
  }

  return { ok: true, preset };
};

/**
 * Renames an existing layout preset.
 */
export const renameUiLayoutPresetById = async (
  id: string,
  name: string
): Promise<UiLayoutPresetResult> => {
  const trimmed = normalizePresetName(name);
  const key = normalizePresetKey(trimmed);
  const existing = await loadUiLayoutPresets();
  const current = existing.find((preset) => preset.id === id);
  if (!current) {
    return { ok: false, reason: 'not_found' };
  }
  if (existing.some((preset) => preset.id !== id && normalizePresetKey(preset.name) === key)) {
    return { ok: false, reason: 'duplicate' };
  }

  const updated: UiLayoutPreset = {
    ...current,
    name: trimmed,
    updatedUtc: utcNow()
  };

  const persisted = await renameUiLayoutPreset(updated);
  if (!persisted) {
    console.warn(`${LOG_PREFIX} Failed to rename layout preset.`);
    return { ok: false, reason: 'persist_failed' };
  }

  return { ok: true, preset: updated };
};

/**
 * Deletes a layout preset by id.
 */
export const deleteUiLayoutPresetById = async (
  id: string
): Promise<UiLayoutPresetResult> => {
  const existing = await loadUiLayoutPresets();
  const current = existing.find((preset) => preset.id === id);
  if (!current) {
    return { ok: false, reason: 'not_found' };
  }

  const removed = await deleteUiLayoutPreset(id);
  if (!removed) {
    console.warn(`${LOG_PREFIX} Failed to delete layout preset.`);
    return { ok: false, reason: 'persist_failed' };
  }

  return { ok: true, preset: current };
};
