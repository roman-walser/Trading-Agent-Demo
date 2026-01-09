// frontend/pages/DashboardPage.tsx
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import HealthPanel from '../features/dashboard/panels/HealthPanel.js';
import PageHeader from '../features/dashboard/components/PageHeader.js';
import GridLayout, { type Layout } from 'react-grid-layout';
import {
  useClearUiLayoutHistory,
  useCreateUiLayoutPreset,
  useDeleteUiLayoutPreset,
  useNavigateUiLayoutHistory,
  usePatchUiLayout,
  useRenameUiLayoutPreset,
  useReplaceUiLayout,
  useUiLayoutHistoryQuery,
  useUiLayoutPresetsQuery,
  useUiLayoutQuery
} from '../query/uiLayout.queries.js';
import type { PanelLayoutDto } from '../api/routes/uiLayout.api.js';
import {
  getDefaultUiLayoutPanels,
  getUiLayoutSnapshot,
  getUiLayoutHistoryNavigation,
  getPanelLayout,
  useUiLayoutState,
  getCachedUiLayoutSnapshot
} from '../state/store.js';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const resizeHandle = (
  <span className="custom-resize-handle" aria-label="Resize panel" />
);
const GRID_COLS = 12;
const MIN_PANEL_COLS = 2;
const MAX_PANEL_COLS = GRID_COLS;
const DEFAULT_PANEL_W = 3;
const DEFAULT_PANEL_H = 8;

const applyCollapsedLayout = (entry: Layout, isCollapsed: boolean): Layout =>
  isCollapsed
    ? {
        ...entry,
        h: 2,
        minH: 2,
        maxH: 2,
        resizeHandles: ['e'],
        isResizable: true
      }
    : {
        ...entry,
        minH: entry.minH ?? 2,
        maxH: entry.maxH,
        resizeHandles: entry.resizeHandles ?? ['se'],
        isResizable: entry.isResizable ?? true
      };

export const DashboardPage = (): JSX.Element => {
  const panels = useMemo(
    () => [
      { id: 'health', label: 'Health', render: (props?: any) => <HealthPanel {...props} /> }
    ],
    []
  );

  const cachedLayout = getCachedUiLayoutSnapshot() ?? undefined;
  const {
    isSuccess: layoutQueryReady,
    isError: layoutError,
    isFetchedAfterMount: layoutFetchedAfterMount
  } = useUiLayoutQuery(true, cachedLayout);
  useUiLayoutHistoryQuery(true);
  const patchUiLayout = usePatchUiLayout();
  const replaceUiLayout = useReplaceUiLayout();
  const clearHistory = useClearUiLayoutHistory();
  const navigateUiLayoutHistory = useNavigateUiLayoutHistory();
  const presetsQuery = useUiLayoutPresetsQuery(true);
  const createPreset = useCreateUiLayoutPreset();
  const renamePreset = useRenameUiLayoutPreset();
  const deletePreset = useDeleteUiLayoutPreset();
  const isSavingLayout = patchUiLayout.status === 'loading';
  const isReplacingLayout = replaceUiLayout.status === 'loading';
  const isClearingHistory = clearHistory.status === 'loading';
  const isNavigatingHistory = navigateUiLayoutHistory.status === 'loading';
  const isPresetBusy =
    createPreset.status === 'loading' ||
    renamePreset.status === 'loading' ||
    deletePreset.status === 'loading';
  const hasFetchedLayout = layoutFetchedAfterMount || layoutError;
  const isInteractionLocked =
    isSavingLayout || isReplacingLayout || isClearingHistory || isNavigatingHistory || !hasFetchedLayout;
  const uiLayoutState = useUiLayoutState();
  const layoutPresets = presetsQuery.data?.layouts ?? [];
  const currentLayoutLabel = useMemo(() => {
    const currentPanels = uiLayoutState.panels ?? {};
    const matchesPanels = (panels: Record<string, PanelLayoutDto>): boolean => {
      const keys = new Set([...Object.keys(currentPanels), ...Object.keys(panels ?? {})]);
      for (const key of keys) {
        const left = currentPanels[key];
        const right = panels?.[key];
        if (!left || !right) return false;
        if (
          left.visible !== right.visible ||
          left.collapsed !== right.collapsed ||
          left.x !== right.x ||
          left.y !== right.y ||
          left.w !== right.w ||
          left.h !== right.h
        ) {
          return false;
        }
      }
      return true;
    };

    const presetMatch = layoutPresets.find((preset) =>
      matchesPanels(preset.snapshot?.panels ?? {})
    );
    if (presetMatch) return presetMatch.name;

    const defaultPanels = getDefaultUiLayoutPanels();
    if (matchesPanels(defaultPanels)) return 'default';

    return 'custom';
  }, [layoutPresets, uiLayoutState]);
  const layoutReady = uiLayoutState.hydrated || layoutQueryReady || layoutError;
  const isLoadingLayout = !layoutReady;
  const [suppressGridTransitions, setSuppressGridTransitions] = useState(true);
  const [gridWidth, setGridWidth] = useState(0);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const isInteractingRef = useRef(false);

  const getLayoutValue = (value: number | undefined, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

  const normalizeLayout = (entry: Layout): Layout => {
    const w = clamp(getLayoutValue(entry.w, DEFAULT_PANEL_W), MIN_PANEL_COLS, MAX_PANEL_COLS);
    const x = clamp(getLayoutValue(entry.x, 0), 0, Math.max(0, GRID_COLS - w));
    const h = getLayoutValue(entry.h, DEFAULT_PANEL_H);
    const y = getLayoutValue(entry.y, 0);
    return {
      ...entry,
      x,
      y,
      w,
      h,
      minW: Math.min(entry.minW ?? MIN_PANEL_COLS, MAX_PANEL_COLS),
      maxW: MAX_PANEL_COLS
    };
  };

  const applyPanelConstraints = (item: Layout, collapsed: boolean): Layout => {
    const normalized = normalizeLayout({
      ...item,
      minW: MIN_PANEL_COLS,
      minH: 2,
      maxW: MAX_PANEL_COLS,
      isResizable: true
    });
    return applyCollapsedLayout(normalized, collapsed);
  };

  const buildLayout = (): Layout[] =>
    panels.map((panel) => {
      const pl = getPanelLayout(panel.id);
      return applyPanelConstraints(
        {
          i: panel.id,
          x: pl.x,
          y: pl.y,
          w: pl.w,
          h: pl.h
        },
        pl.collapsed ?? false
      );
    });

  const mergeLayout = (next: Layout[], prev: Layout[]): Layout[] => {
    const mergedVisible = next.map((item) => {
      const prevItem = prev.find((entry) => entry.i === item.i);
      return {
        ...item,
        minW: prevItem?.minW ?? item.minW,
        maxW: prevItem?.maxW ?? item.maxW,
        minH: prevItem?.minH ?? item.minH,
        maxH: prevItem?.maxH ?? item.maxH,
        isResizable: prevItem?.isResizable ?? item.isResizable,
        isDraggable: prevItem?.isDraggable ?? item.isDraggable,
        resizeHandles: prevItem?.resizeHandles ?? item.resizeHandles
      };
    });
    const hidden = prev.filter((entry) => !next.find((item) => item.i === entry.i));
    return [...mergedVisible, ...hidden];
  };

  const computedLayout = useMemo(() => buildLayout(), [panels, uiLayoutState]);
  const [gridLayout, setGridLayout] = useState<Layout[]>(() => buildLayout());

  useLayoutEffect(() => {
    if (!layoutReady) {
      setSuppressGridTransitions(true);
      return;
    }
    if (isInteractingRef.current) return;
    setSuppressGridTransitions(true);
    setGridLayout(computedLayout);
    const frame = requestAnimationFrame(() => setSuppressGridTransitions(false));
    return () => cancelAnimationFrame(frame);
  }, [layoutReady, computedLayout]);

  useLayoutEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const updateWidth = (): void => {
      const nextWidth = Math.round(container.getBoundingClientRect().width);
      if (nextWidth <= 0) return;
      setGridWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateWidth);
      observer.observe(container);
    }

    window.addEventListener('resize', updateWidth, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const persistPanelState = (
    panelId: string,
    entry: Layout,
    collapsedState: boolean,
    visibleState: boolean
  ): void => {
    if (isInteractionLocked) return;
    const dto: PanelLayoutDto = {
      visible: visibleState,
      collapsed: collapsedState,
      x: entry.x,
      y: entry.y,
      w: entry.w,
      h: entry.h
    };

    patchUiLayout.mutate({
      panels: {
        [panelId]: dto
      }
    });
  };

  const persistLayoutState = (layout: Layout[]): void => {
    if (isInteractionLocked) return;
    if (layout.length === 0) return;
    const panelsPayload: Record<string, PanelLayoutDto> = {};
    layout.forEach((item) => {
      const panelState = getPanelLayout(item.i);
      const dto: PanelLayoutDto = {
        visible: panelState.visible ?? true,
        collapsed: panelState.collapsed ?? false,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      };
      panelsPayload[item.i] = dto;
    });

    patchUiLayout.mutate({ panels: panelsPayload });
  };

  const handleInteractionStart = (): void => {
    if (isInteractionLocked) return;
    isInteractingRef.current = true;
  };

  const handleInteractionStop = (layout: Layout[]): void => {
    if (isInteractionLocked) return;
    isInteractingRef.current = false;
    const normalizedLayout = layout.map((item) =>
      applyPanelConstraints(item, getPanelLayout(item.i).collapsed ?? false)
    );
    setGridLayout((prev) => mergeLayout(normalizedLayout, prev));
    persistLayoutState(normalizedLayout);
  };

  const togglePanel = (id: string): void => {
    if (isInteractionLocked) return;
    const panelState = getPanelLayout(id);
    const nextVisible = !panelState.visible;
    const nextLayout = applyPanelConstraints({
      i: id,
      x: panelState.x,
      y: panelState.y,
      w: panelState.w,
      h: panelState.h
    }, panelState.collapsed ?? false);
    setGridLayout((prev) => {
      const exists = prev.some((entry) => entry.i === id);
      if (!exists) return [...prev, nextLayout];
      return prev.map((entry) => (entry.i === id ? nextLayout : entry));
    });
    persistPanelState(id, nextLayout, panelState.collapsed ?? false, nextVisible);
  };

  const panelVisibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    panels.forEach((panel) => {
      const pl = getPanelLayout(panel.id);
      map[panel.id] = pl.visible ?? true;
    });
    return map;
  }, [panels, uiLayoutState]);

  const activePanels = panels.filter((panel) => panelVisibility[panel.id]);
  const canGoBack = uiLayoutState.historyPast.length > 0;
  const canGoForward = uiLayoutState.historyFuture.length > 0;

  const handleHistoryNavigation = (direction: 'back' | 'forward'): void => {
    if (isInteractionLocked) return;
    const navigation = getUiLayoutHistoryNavigation(direction);
    if (!navigation) return;
    navigateUiLayoutHistory.mutate(navigation);
  };

  const handleBack = (): void => handleHistoryNavigation('back');

  const handleForward = (): void => handleHistoryNavigation('forward');

  const handleDefaultLayout = (): void => {
    if (isInteractionLocked) return;
    replaceUiLayout.mutate({ panels: getDefaultUiLayoutPanels() });
  };

  const handleDeleteHistory = (): void => {
    if (isInteractionLocked) return;
    clearHistory.mutate();
  };

  const handleSaveLayoutPreset = (name: string): void => {
    if (isInteractionLocked || isPresetBusy) return;
    const snapshot = getUiLayoutSnapshot();
    createPreset.mutate({ name, snapshot });
  };

  const handleCreateLayoutPreset = (name: string): void => {
    if (isInteractionLocked || isPresetBusy) return;
    const snapshot = { panels: getDefaultUiLayoutPanels(), lastUpdatedUtc: null };
    createPreset.mutate(
      { name, snapshot },
      {
        onSuccess: () => {
          replaceUiLayout.mutate({ panels: snapshot.panels });
        }
      }
    );
  };

  const handleRenameLayoutPreset = (id: string, name: string): void => {
    if (isInteractionLocked || isPresetBusy) return;
    renamePreset.mutate({ id, payload: { name } });
  };

  const handleDeleteLayoutPreset = (id: string): void => {
    if (isInteractionLocked || isPresetBusy) return;
    deletePreset.mutate(id);
  };

  const handleApplyLayoutPreset = (id: string): void => {
    if (isInteractionLocked || isPresetBusy) return;
    const preset = layoutPresets.find((entry) => entry.id === id);
    if (!preset) return;
    replaceUiLayout.mutate({ panels: preset.snapshot.panels });
  };

  const handleCollapseChange = (id: string, isCollapsed: boolean): void => {
    if (isInteractionLocked) return;
    const panelState = getPanelLayout(id);
    const nextHeight =
      isCollapsed ? 2 : Math.max(panelState.h ?? DEFAULT_PANEL_H, DEFAULT_PANEL_H);
    const nextLayout = applyCollapsedLayout(
      normalizeLayout({
        i: id,
        x: panelState.x,
        y: panelState.y,
        w: panelState.w,
        h: nextHeight,
        minW: MIN_PANEL_COLS,
        minH: 2,
        maxW: MAX_PANEL_COLS,
        isResizable: true
      }),
      isCollapsed
    );
    setGridLayout((prev) => {
      const exists = prev.some((entry) => entry.i === id);
      if (!exists) return [...prev, nextLayout];
      return prev.map((entry) => (entry.i === id ? nextLayout : entry));
    });
    persistPanelState(id, nextLayout, isCollapsed, panelState.visible);
  };

  return (
    <div className="w-full min-h-screen">
      <PageHeader
        title="Demo Project"
        panels={panels}
        visible={panelVisibility}
        onTogglePanel={togglePanel}
        onBack={handleBack}
        onForward={handleForward}
        onDefaultLayout={handleDefaultLayout}
        onDeleteHistory={handleDeleteHistory}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        layoutPresets={layoutPresets}
        onApplyLayoutPreset={handleApplyLayoutPreset}
        onSaveLayoutPreset={handleSaveLayoutPreset}
        onCreateLayoutPreset={handleCreateLayoutPreset}
        onRenameLayoutPreset={handleRenameLayoutPreset}
        onDeleteLayoutPreset={handleDeleteLayoutPreset}
        layoutPresetsCurrentName={currentLayoutLabel}
        layoutPresetsBusy={isPresetBusy}
        disabled={isInteractionLocked}
      />

      <div className="bg-transparent">
        <div className="max-w-[100rem] mx-auto px-6 py-10" ref={gridContainerRef}>
          {isLoadingLayout ? (
            <div className="text-center text-[#7d8caf] font-semibold py-8">Loading layout...</div>
          ) : activePanels.length === 0 ? (
            <div className="text-center text-[#7d8caf] font-semibold py-8">No panels selected</div>
          ) : (
            <GridLayout
              className={`layout ${suppressGridTransitions ? 'layout-initial' : ''}`}
              layout={gridLayout.filter((entry) => panelVisibility[entry.i])}
              cols={GRID_COLS}
              width={Math.max(gridWidth, 1)}
              rowHeight={30}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              isResizable={!isInteractionLocked}
              draggableHandle=".panel-drag-handle"
              draggableCancel=".panel-toggle"
              resizeHandles={['se']}
              compactType={null}
              verticalCompact={false}
              isBounded={false}
              resizeHandle={resizeHandle}
              isDraggable={!isInteractionLocked}
              onLayoutChange={(newLayout: Layout[]) =>
                setGridLayout((prev) => mergeLayout(newLayout, prev))
              }
              onDragStart={handleInteractionStart}
              onDragStop={(layout) => handleInteractionStop(layout)}
              onResizeStart={handleInteractionStart}
              onResizeStop={(layout) => handleInteractionStop(layout)}
            >
              {activePanels.map((panel) => (
                <div
                  key={panel.id}
                  data-grid={applyPanelConstraints(
                    gridLayout.find((entry) => entry.i === panel.id) ?? {
                      i: panel.id,
                      x: 0,
                      y: 0,
                      w: DEFAULT_PANEL_W,
                      h: DEFAULT_PANEL_H,
                      minW: MIN_PANEL_COLS,
                      minH: 2,
                      maxW: MAX_PANEL_COLS,
                      isResizable: true
                    },
                    getPanelLayout(panel.id).collapsed ?? false
                  )}
                  className="resizable-item min-w-[18rem] h-full"
                >
                  {panel.render({
                    collapsed: getPanelLayout(panel.id).collapsed,
                    onCollapseChange: (collapsed: boolean) => handleCollapseChange(panel.id, collapsed),
                    interactionDisabled: isInteractionLocked
                  })}
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
