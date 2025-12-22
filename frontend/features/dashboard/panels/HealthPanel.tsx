// frontend/features/dashboard/panels/HealthPanel.tsx
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { HEALTH_POLL_INTERVAL_MS } from '../../../config/polling.config.js';
import { useHealthQuery } from '../../../query/health.queries.js';
import { WS_PATH, useWsConnectionState } from '../../../api/wsClient.js';

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

const HealthPanelContent = (): JSX.Element => {
  const { data, isError, dataUpdatedAt, error } = useHealthQuery(HEALTH_POLL_INTERVAL_MS, true);
  const wsStatus = useWsConnectionState();
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const httpTone: BadgeTone = isError ? 'err' : data?.ok ? 'ok' : 'warn';
  const wsTone: BadgeTone =
    wsStatus === 'connected' ? 'ok' : wsStatus === 'connecting' ? 'warn' : 'err';

  const lastUpdate = useMemo(() => formatAgo(dataUpdatedAt, now), [dataUpdatedAt, now]);
  const httpLabel = isError ? 'unreachable' : data?.ok ? 'reachable' : 'unknown';
  const wsLabel =
    wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'reconnecting' : 'disconnected';

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
            <span className={badgeClass(httpTone)}>{data?.ok ? '200 OK' : 'check'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#7d8caf]">Last fetch</span>
            <span className="text-[#7d8caf]">{lastUpdate}</span>
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
            <span className={badgeClass(wsTone)}>{wsStatus}</span>
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
  onCollapseChange?: (collapsed: boolean) => void;
};

export const HealthPanel = ({ onCollapseChange }: HealthPanelProps): JSX.Element => {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mouseDownInsideRef = useRef(false);
  const containerClasses =
    'relative flex flex-col rounded-2xl border border-[rgba(66,112,190,0.35)] bg-[linear-gradient(155deg,rgba(16,25,43,0.92),rgba(12,19,32,0.9))] shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.02)] overflow-hidden select-none ' +
    (collapsed ? 'h-auto' : 'h-full');
  const bodyClasses = `${collapsed ? 'flex-none' : 'flex-1'} transition-[height,opacity] duration-300 ease-in-out overflow-hidden`;

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
    const handleMouseUp = (): void => {
      mouseDownInsideRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseDownCapture = (): void => {
    mouseDownInsideRef.current = true;
  };

  const handleMouseMoveCapture = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.buttons && !mouseDownInsideRef.current) {
      event.preventDefault();
      const selection = window.getSelection();
      selection?.removeAllRanges();
    }
  };

  return (
    <div
      className={containerClasses}
      ref={panelRef}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseMoveCapture={handleMouseMoveCapture}
    >
      <div className="flex items-center justify-between px-4 py-3 text-[#dbe7ff] font-extrabold uppercase tracking-wide text-sm panel-drag-handle select-none">
        <div className="flex items-center gap-2 text-base">Server Health</div>
        <button
          type="button"
          className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-bold transition hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)] panel-toggle select-none"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          onClick={() => {
            setCollapsed((c) => {
              const next = !c;
              onCollapseChange?.(next);
              return next;
            });
          }}
        >
          {collapsed ? '▾' : '▴'}
        </button>
      </div>

      <div
        className={bodyClasses}
        style={{
          height: collapsed ? 0 : '100%',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto'
        }}
      >
        {!collapsed ? <HealthPanelContent /> : null}
      </div>
    </div>
  );
};

export default HealthPanel;
