// frontend/query/uiLayout.queries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clearUiLayoutHistory,
  createUiLayoutPreset,
  deleteUiLayoutPreset,
  fetchUiLayout,
  fetchUiLayoutHistory,
  fetchUiLayoutPresets,
  patchUiLayout,
  renameUiLayoutPreset,
  replaceUiLayout,
  type UiLayoutHistoryClearDto,
  type UiLayoutHistoryDto,
  type UiLayoutPayloadDto,
  type UiLayoutPresetCreateDto,
  type UiLayoutPresetDeleteDto,
  type UiLayoutPresetDto,
  type UiLayoutPresetRenameDto,
  type UiLayoutPresetResponseDto,
  type UiLayoutPresetsDto,
  type UiLayoutStateDto
} from '../api/routes/uiLayout.api.js';
import { UI_LAYOUT_HISTORY_LIMIT } from '../state/uiLayout.slice.js';
import {
  applyUiLayoutHistorySnapshot,
  clearUiLayoutHistory as clearUiLayoutHistoryState,
  getUiLayoutSnapshot,
  getUiLayoutHistoryState,
  hydrateUiLayoutFromSnapshot,
  recordUiLayoutHistory,
  restoreUiLayoutSnapshot,
  setPanelLayout
} from '../state/store.js';

const UI_LAYOUT_QUERY_KEY = ['ui-layout'];
const UI_LAYOUT_FETCH_TIMEOUT_MS = 8000;
const UI_LAYOUT_HISTORY_QUERY_KEY = ['ui-layout-history'];
const UI_LAYOUT_HISTORY_FETCH_TIMEOUT_MS = 8000;
const UI_LAYOUT_PATCH_TIMEOUT_MS = 8000;
const UI_LAYOUT_REPLACE_TIMEOUT_MS = 8000;
const UI_LAYOUT_HISTORY_FETCH_LIMIT = UI_LAYOUT_HISTORY_LIMIT + 1;
const UI_LAYOUT_PRESETS_QUERY_KEY = ['ui-layout-presets'];
const UI_LAYOUT_PRESETS_FETCH_TIMEOUT_MS = 8000;

const toTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isStaleServerSnapshot = (nextSnapshot: UiLayoutStateDto): boolean => {
  const currentSnapshot = getUiLayoutSnapshot();
  const currentTs = toTimestamp(currentSnapshot.lastUpdatedUtc);
  const nextTs = toTimestamp(nextSnapshot.lastUpdatedUtc);
  if (currentTs === null || nextTs === null) return false;
  return nextTs < currentTs;
};

const sortPresets = (presets: UiLayoutPresetDto[]): UiLayoutPresetDto[] =>
  [...presets].sort((a, b) => {
    const updated = b.updatedUtc.localeCompare(a.updatedUtc);
    if (updated !== 0) return updated;
    return a.name.localeCompare(b.name);
  });

const updatePresetsCache = (
  client: ReturnType<typeof useQueryClient>,
  updater: (presets: UiLayoutPresetDto[]) => UiLayoutPresetDto[]
): void => {
  client.setQueryData(UI_LAYOUT_PRESETS_QUERY_KEY, (current?: UiLayoutPresetsDto) => {
    const layouts = current?.layouts ?? [];
    return { layouts: updater(layouts) };
  });
};

type UiLayoutMutationContext = {
  previousSnapshot: UiLayoutStateDto;
};

export type UiLayoutHistoryNavigation = {
  snapshot: UiLayoutStateDto;
  past: UiLayoutStateDto[];
  future: UiLayoutStateDto[];
};

type UiLayoutHistoryMutationContext = {
  previousSnapshot: UiLayoutStateDto;
  previousPast: UiLayoutStateDto[];
  previousFuture: UiLayoutStateDto[];
  nextPast: UiLayoutStateDto[];
  nextFuture: UiLayoutStateDto[];
};

type UiLayoutClearHistoryContext = {
  previousSnapshot: UiLayoutStateDto;
  previousPast: UiLayoutStateDto[];
  previousFuture: UiLayoutStateDto[];
};

export const useUiLayoutQuery = (enabled = true, initialData?: UiLayoutStateDto) =>
  useQuery<UiLayoutStateDto>({
    queryKey: UI_LAYOUT_QUERY_KEY,
    queryFn: () => fetchUiLayout({ timeoutMs: UI_LAYOUT_FETCH_TIMEOUT_MS }),
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
    initialData,
    onSuccess: (snapshot) => {
      if (isStaleServerSnapshot(snapshot)) {
        return;
      }
      hydrateUiLayoutFromSnapshot(snapshot);
    }
  });

export const useUiLayoutHistoryQuery = (enabled = true) => {
  const client = useQueryClient();
  return useQuery<UiLayoutHistoryDto>({
    queryKey: UI_LAYOUT_HISTORY_QUERY_KEY,
    queryFn: () =>
      fetchUiLayoutHistory(UI_LAYOUT_HISTORY_FETCH_LIMIT, {
        timeoutMs: UI_LAYOUT_HISTORY_FETCH_TIMEOUT_MS
      }),
    refetchOnWindowFocus: false,
    retry: false,
    enabled,
    onSuccess: (data) => {
      const snapshots = data?.snapshots ?? [];
      if (snapshots.length === 0) return;
      const currentSnapshot = snapshots[snapshots.length - 1];
      if (isStaleServerSnapshot(currentSnapshot)) {
        return;
      }
      const past = snapshots.slice(0, -1);
      applyUiLayoutHistorySnapshot(currentSnapshot, past, [], 'server', true);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, currentSnapshot);
    }
  });
};

export const useUiLayoutPresetsQuery = (enabled = true) =>
  useQuery<UiLayoutPresetsDto>({
    queryKey: UI_LAYOUT_PRESETS_QUERY_KEY,
    queryFn: () => fetchUiLayoutPresets({ timeoutMs: UI_LAYOUT_PRESETS_FETCH_TIMEOUT_MS }),
    refetchOnWindowFocus: false,
    retry: false,
    enabled
  });

export const usePatchUiLayout = () => {
  const client = useQueryClient();
  return useMutation<UiLayoutStateDto, Error, UiLayoutPayloadDto, UiLayoutMutationContext>({
    mutationFn: (payload: UiLayoutPayloadDto) =>
      patchUiLayout(payload, { timeoutMs: UI_LAYOUT_PATCH_TIMEOUT_MS }),
    onMutate: (payload) => {
      const previousSnapshot = getUiLayoutSnapshot();
      for (const [panelId, layout] of Object.entries(payload.panels)) {
        setPanelLayout(panelId, layout, false);
      }
      return { previousSnapshot };
    },
    onError: (_error, _payload, context) => {
      if (!context?.previousSnapshot) return;
      restoreUiLayoutSnapshot(context.previousSnapshot);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, context.previousSnapshot);
    },
    onSuccess: (data, _payload, context) => {
      if (isStaleServerSnapshot(data)) {
        return;
      }
      client.setQueryData(UI_LAYOUT_QUERY_KEY, data);
      if (context?.previousSnapshot) {
        recordUiLayoutHistory(context.previousSnapshot, data);
        return;
      }
      hydrateUiLayoutFromSnapshot(data);
    }
  });
};

export const useNavigateUiLayoutHistory = () => {
  const client = useQueryClient();
  return useMutation<UiLayoutStateDto, Error, UiLayoutHistoryNavigation, UiLayoutHistoryMutationContext>({
    mutationFn: (payload) =>
      replaceUiLayout(
        { panels: payload.snapshot.panels },
        { timeoutMs: UI_LAYOUT_REPLACE_TIMEOUT_MS }
      ),
    onMutate: (payload) => {
      const previousSnapshot = getUiLayoutSnapshot();
      const historyState = getUiLayoutHistoryState();
      applyUiLayoutHistorySnapshot(payload.snapshot, payload.past, payload.future, 'history', true);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, payload.snapshot);
      return {
        previousSnapshot,
        previousPast: historyState.past,
        previousFuture: historyState.future,
        nextPast: payload.past,
        nextFuture: payload.future
      };
    },
    onError: (_error, _payload, context) => {
      if (!context) return;
      applyUiLayoutHistorySnapshot(
        context.previousSnapshot,
        context.previousPast,
        context.previousFuture,
        'server',
        true
      );
      client.setQueryData(UI_LAYOUT_QUERY_KEY, context.previousSnapshot);
    },
    onSuccess: (data, payload, context) => {
      if (isStaleServerSnapshot(data)) {
        return;
      }
      const nextPast = context?.nextPast ?? payload.past;
      const nextFuture = context?.nextFuture ?? payload.future;
      applyUiLayoutHistorySnapshot(data, nextPast, nextFuture, 'server', true);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, data);
    }
  });
};

export const useReplaceUiLayout = () => {
  const client = useQueryClient();
  return useMutation<UiLayoutStateDto, Error, UiLayoutPayloadDto, UiLayoutMutationContext>({
    mutationFn: (payload: UiLayoutPayloadDto) =>
      replaceUiLayout(payload, { timeoutMs: UI_LAYOUT_REPLACE_TIMEOUT_MS }),
    onMutate: () => {
      const previousSnapshot = getUiLayoutSnapshot();
      return { previousSnapshot };
    },
    onError: (_error, _payload, context) => {
      if (!context?.previousSnapshot) return;
      restoreUiLayoutSnapshot(context.previousSnapshot);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, context.previousSnapshot);
    },
    onSuccess: (data, _payload, context) => {
      if (isStaleServerSnapshot(data)) {
        return;
      }
      client.setQueryData(UI_LAYOUT_QUERY_KEY, data);
      if (context?.previousSnapshot) {
        recordUiLayoutHistory(context.previousSnapshot, data);
        return;
      }
      hydrateUiLayoutFromSnapshot(data);
    }
  });
};

export const useClearUiLayoutHistory = () => {
  const client = useQueryClient();
  return useMutation<UiLayoutHistoryClearDto, Error, void, UiLayoutClearHistoryContext>({
    mutationFn: () => clearUiLayoutHistory({ timeoutMs: UI_LAYOUT_REPLACE_TIMEOUT_MS }),
    onMutate: () => {
      const previousSnapshot = getUiLayoutSnapshot();
      const historyState = getUiLayoutHistoryState();
      clearUiLayoutHistoryState(true);
      return {
        previousSnapshot,
        previousPast: historyState.past,
        previousFuture: historyState.future
      };
    },
    onError: (_error, _payload, context) => {
      if (!context) return;
      applyUiLayoutHistorySnapshot(
        context.previousSnapshot,
        context.previousPast,
        context.previousFuture,
        'server',
        true
      );
      client.setQueryData(UI_LAYOUT_QUERY_KEY, context.previousSnapshot);
    },
    onSuccess: (data, _payload, context) => {
      const snapshot = data?.snapshot ?? context?.previousSnapshot;
      if (!snapshot) return;
      applyUiLayoutHistorySnapshot(snapshot, [], [], 'server', true);
      client.setQueryData(UI_LAYOUT_QUERY_KEY, snapshot);
      client.setQueryData(UI_LAYOUT_HISTORY_QUERY_KEY, { snapshots: [snapshot] });
    }
  });
};

export const useCreateUiLayoutPreset = () => {
  const client = useQueryClient();
  return useMutation<UiLayoutPresetResponseDto, Error, UiLayoutPresetCreateDto>({
    mutationFn: (payload: UiLayoutPresetCreateDto) =>
      createUiLayoutPreset(payload, { timeoutMs: UI_LAYOUT_REPLACE_TIMEOUT_MS }),
    onSuccess: (data) => {
      const preset = data?.preset;
      if (!preset) return;
      updatePresetsCache(client, (layouts) => sortPresets([preset, ...layouts]));
    }
  });
};

export const useRenameUiLayoutPreset = () => {
  const client = useQueryClient();
  return useMutation<
    UiLayoutPresetResponseDto,
    Error,
    { id: string; payload: UiLayoutPresetRenameDto }
  >({
    mutationFn: ({ id, payload }) =>
      renameUiLayoutPreset(id, payload, { timeoutMs: UI_LAYOUT_REPLACE_TIMEOUT_MS }),
    onSuccess: (data) => {
      const preset = data?.preset;
      if (!preset) return;
      updatePresetsCache(client, (layouts) =>
        sortPresets(layouts.map((entry) => (entry.id === preset.id ? preset : entry)))
      );
    }
  });
};

export const useDeleteUiLayoutPreset = () => {
  const client = useQueryClient();
  return useMutation<UiLayoutPresetDeleteDto, Error, string>({
    mutationFn: (id: string) => deleteUiLayoutPreset(id, { timeoutMs: UI_LAYOUT_REPLACE_TIMEOUT_MS }),
    onSuccess: (data) => {
      const removed = data?.removed;
      if (!removed) return;
      updatePresetsCache(client, (layouts) =>
        sortPresets(layouts.filter((entry) => entry.id !== removed.id))
      );
    }
  });
};
