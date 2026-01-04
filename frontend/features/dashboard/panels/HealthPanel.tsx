// frontend/features/dashboard/panels/HealthPanel.tsx
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { HEALTH_POLL_INTERVAL_MS } from '../../../config/polling.config.js';
import { useHealthQuery } from '../../../query/health.queries.js';
import { WS_PATH, useWsConnectionState } from '../../../api/wsClient.js';
import { useHealthState } from '../../../state/store.js';

type BadgeTone = 'ok' | 'warn' | 'err';

const formatAgo = (timestamp?: number, now?: number): string => {
  if (!timestamp) return 'no data yet';

  const diffMs = (now ?? Date.now()) - timestamp;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes === 0) {
    return `${seconds}s ago`;
  }

  return `${minutes}m ${seconds}s ago`;
};

const badgeToneClass: Record<BadgeTone, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40',
  warn: 'bg-amber-400/15 text-amber-200 border border-amber-300/40',
  err: 'bg-red-500/15 text-red-300 border border-red-400/40'
};

const badgeClass = (tone: BadgeTone): string =>
  `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${badgeToneClass[tone]}`;

type TimeAgoLabelProps = {
  lastCheckedAtUtc?: string | null;
  className?: string;
};

const LABEL_TICK_MS = 1000;

const TimeAgoLabel = memo(
  ({ lastCheckedAtUtc, className }: TimeAgoLabelProps): JSX.Element => {
    const getLabel = (): string => {
      const tsMs = lastCheckedAtUtc ? Date.parse(lastCheckedAtUtc) : undefined;
      const safeTs = Number.isFinite(tsMs) ? tsMs : undefined;
      return formatAgo(safeTs, Date.now());
    };

    const [label, setLabel] = useState<string>(getLabel);

    useEffect(() => {
      setLabel(getLabel());
      const timer = setInterval(() => setLabel(getLabel()), LABEL_TICK_MS);
      return () => clearInterval(timer);
    }, [lastCheckedAtUtc]);

    return <span className={className}>{label}</span>;
  }
);

type HealthPanelContentProps = {
  pollingEnabled: boolean;
};

const HealthPanelContent = ({ pollingEnabled }: HealthPanelContentProps): JSX.Element => {
  const { isError, error } = useHealthQuery(HEALTH_POLL_INTERVAL_MS, pollingEnabled);
  const wsStatus = useWsConnectionState();
  const health = useHealthState();

  const wsStatusText = wsStatus ?? 'disconnected';

  const httpTone: BadgeTone = isError ? 'err' : health?.ok ? 'ok' : 'warn';
  const wsTone: BadgeTone =
    wsStatusText === 'connected' ? 'ok' : wsStatusText === 'connecting' ? 'warn' : 'err';

  const httpLabel = isError ? 'unreachable' : health?.ok ? 'reachable' : 'unknown';
  const wsLabel =
    wsStatusText === 'connected'
      ? 'connected'
      : wsStatusText === 'connecting'
        ? 'reconnecting'
        : 'disconnected';

  return (
    <div className="flex h-full flex-col select-text">
      <div className="flex flex-1 flex-col">
        <div className="grid gap-4 px-4 pb-4 text-[#9fb2d6] text-sm">
          <div className="rounded-xl border border-[rgba(80,140,255,0.25)] bg-[#101c32b3] p-3 shadow-inner">
            <div className="flex items-center justify-between mb-2 text-[#7d8caf] text-xs uppercase tracking-wide">
              <span>HTTP API</span>
            </div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-base text-[#dfe8ff] font-bold">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(255,255,255,0.05)]" />
                {httpLabel}
              </div>
              <span className={badgeClass(httpTone)}>{health?.ok ? '200 OK' : 'check'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#7d8caf]">Last fetch</span>
              <TimeAgoLabel
                lastCheckedAtUtc={health?.lastCheckedAtUtc}
                className="text-[#7d8caf]"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#7d8caf]">HTTP poll</span>
              <span className="text-[#7d8caf]">{HEALTH_POLL_INTERVAL_MS / 1000}s interval</span>
            </div>
            {isError ? (
              <div className="mt-2 text-xs text-[#f17868]">
                Error: {(error as Error | undefined)?.message ?? 'unknown'}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-[rgba(80,140,255,0.25)] bg-[#101c32b3] p-3 shadow-inner">
            <div className="flex items-center justify-between mb-2 text-[#7d8caf] text-xs uppercase tracking-wide">
              <span>WebSocket</span>
            </div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-base text-[#dfe8ff] font-bold">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(255,255,255,0.05)]" />
                {wsLabel}
              </div>
              <span className={`${badgeClass(wsTone)} inline-flex min-w-[7.5rem] justify-center`}>
                {wsStatusText}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#7d8caf]">Endpoint</span>
              <span className="mono">{WS_PATH}</span>
            </div>
          </div>
        </div>

        <div className="mt-auto flex justify-end items-center px-4 py-3 border-t border-[rgba(83,121,196,0.2)] text-xs text-[#7d8caf] bg-[#0c132099]">
          <div className="text-right leading-tight">
            <div>
              Source HTTP: <code className="text-[#dfe8ff]">/api/health</code> (interval)
            </div>
            <div>
              Source WS: <code className="text-[#dfe8ff]">{WS_PATH}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type HealthPanelProps = {
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
};

export const HealthPanel = ({ onCollapseChange, collapsed: collapsedProp }: HealthPanelProps): JSX.Element => {
  const [collapsed, setCollapsed] = useState(collapsedProp ?? false);
  const [availableHeight, setAvailableHeight] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const pollingEnabled = !collapsed;
  const SCROLL_EPSILON = 12;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const bodyContentRef = useRef<HTMLDivElement | null>(null);
  const containerClasses =
    'relative flex flex-col rounded-2xl border border-[rgba(66,112,190,0.35)] bg-[linear-gradient(155deg,rgba(16,25,43,0.92),rgba(12,19,32,0.9))] shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden select-none ' +
    (collapsed ? 'h-auto' : 'h-full');
  const bodyClasses = `${collapsed ? '+' : '-'} transition-[height,opacity] duration-300 ease-in-out min-h-0`;

  useEffect(() => {
    const el = panelRef.current;
    const parent = el?.parentElement;
    if (!el || !parent || typeof ResizeObserver === 'undefined') return undefined;

    const updateHandleOffset = (): void => {
      const offset = Math.max(0, parent.clientHeight - el.clientHeight);
      parent.style.setProperty('--panel-handle-offset', `${offset}px`);
    };

    updateHandleOffset();

    const observer = new ResizeObserver(updateHandleOffset);
    observer.observe(el);
    observer.observe(parent);

    return () => observer.disconnect();
  }, [collapsed]);

  useEffect(() => {
    setCollapsed(collapsedProp ?? false);
  }, [collapsedProp]);

  useLayoutEffect(() => {
    const panelEl = panelRef.current;
    const headerEl = headerRef.current;
    if (!panelEl || !headerEl || typeof ResizeObserver === 'undefined') return undefined;

    const updateHeights = (): void => {
      const panelHeight = panelEl.clientHeight;
      const headerHeight = headerEl.clientHeight;
      setAvailableHeight(Math.max(panelHeight - headerHeight, 0));
    };

    updateHeights();

    const panelObserver = new ResizeObserver(updateHeights);
    const headerObserver = new ResizeObserver(updateHeights);
    panelObserver.observe(panelEl);
    headerObserver.observe(headerEl);

    const handleResize = (): void => updateHeights();
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      panelObserver.disconnect();
      headerObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useLayoutEffect(() => {
    const contentEl = bodyContentRef.current;
    if (!contentEl || typeof ResizeObserver === 'undefined') return undefined;

    const updateContentHeight = (): void => {
      setContentHeight(contentEl.scrollHeight);
    };

    updateContentHeight();
    const observer = new ResizeObserver(updateContentHeight);
    observer.observe(contentEl);

    return () => observer.disconnect();
  }, []);

  const bodyHeight = collapsed ? 0 : availableHeight || 'auto';
  const effectiveHeight = typeof bodyHeight === 'number' ? bodyHeight : Number.MAX_SAFE_INTEGER;
  const hasSizedBody = !collapsed && typeof bodyHeight === 'number' && bodyHeight > 0;
  const shouldScroll = hasSizedBody && contentHeight - effectiveHeight > SCROLL_EPSILON;
  const overflowY = shouldScroll ? 'auto' : 'hidden';
  const overflowX = 'hidden';
  const scrollbarStyles: CSSProperties = shouldScroll
    ? {
        scrollbarWidth: 'thin',
        scrollbarColor: '#4c6fb3 #0d172b'
      }
    : {};

  return (
    <div
      className={containerClasses}
      ref={panelRef}
    >
      <div
        className="flex items-center justify-between px-4 py-3 text-[#dbe7ff] font-extrabold uppercase tracking-wide text-sm panel-drag-handle select-none"
        ref={headerRef}
      >
        <div className="flex items-center gap-2 text-base">Server Health</div>
        <button
          type="button"
          className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-bold transition hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)] panel-toggle select-none"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          onClick={() => {
            setCollapsed((current) => {
              const next = !current;
              onCollapseChange?.(next);
              return next;
            });
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {collapsed ? (
              <polyline points="6 9 12 15 18 9" />
            ) : (
              <polyline points="18 15 12 9 6 15" />
            )}
          </svg>
        </button>
      </div>

      <div
        className={bodyClasses}
        style={{
          height: bodyHeight,
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          overflowY,
          overflowX,
          ...scrollbarStyles
        }}
        ref={bodyRef}
      >
        <div ref={bodyContentRef} className="h-full flex flex-col">
          <HealthPanelContent pollingEnabled={pollingEnabled} />
        </div>
      </div>
    </div>
  );
};

export default HealthPanel;
