// frontend/features/dashboard/panels/HealthPanel.tsx
import { useEffect, useMemo, useState } from 'react';
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

const badgeClass = (tone: BadgeTone): string => `badge badge--${tone}`;

export const HealthPanel = (): JSX.Element => {
  const { data, isFetching, isError, dataUpdatedAt, error } = useHealthQuery(HEALTH_POLL_INTERVAL_MS);
  const wsStatus = useWsConnectionState();
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const httpTone: BadgeTone = isError ? 'err' : data?.ok ? 'ok' : 'warn';
  const wsTone: BadgeTone = wsStatus === 'connected' ? 'ok' : wsStatus === 'connecting' ? 'warn' : 'err';

  const lastUpdate = useMemo(() => formatAgo(dataUpdatedAt, now), [dataUpdatedAt, now]);
  const httpLabel = isError ? 'unreachable' : data?.ok ? 'reachable' : 'unknown';
  const wsLabel = wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'reconnecting' : 'disconnected';
  const headerStatus = isFetching ? 'polling...' : 'up to date';

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="panel__title">Health</div>
      </div>

      <div className="panel__content panel__content--stack">
        <div className="health-grid">
          <div className="health-card">
            <div className="health-card__label">HTTP API</div>
            <div className="health-card__status">
              <span className={`status-dot status-dot--${httpTone}`} />
              <span className="health-card__value">{httpLabel}</span>
              <span className={badgeClass(httpTone)}>{data?.ok ? '200 OK' : 'check'}</span>
            </div>
            <div className="health-card__meta">
              <span className="muted">Last fetch</span>
              <span className="muted">{lastUpdate}</span>
            </div>
            <div className="health-card__meta">
              <span className="muted">HTTP poll</span>
              <span className="muted">{HEALTH_POLL_INTERVAL_MS / 1000}s interval</span>
            </div>
          </div>
          <div className="health-card">
            <div className="health-card__label">WebSocket</div>
            <div className="health-card__status">
              <span className={`status-dot status-dot--${wsTone}`} />
              <span className="health-card__value">{wsLabel}</span>
              <span className={badgeClass(wsTone)}>{wsStatus}</span>
            </div>
            <div className="health-card__meta">
              <span className="muted">Endpoint</span>
              <span className="mono">{WS_PATH}</span>
            </div>
          </div>
        </div>

        {isError ? (
          <div className="muted">Error: {(error as Error | undefined)?.message ?? 'unknown'}</div>
        ) : null}
      </div>

      <div className="panel__footer">
        <div />
        <div className="panel__footer-source">
          <div>Source HTTP: `/api/health` (interval)</div>
          <div>Source WS: `{WS_PATH}`</div>
        </div>
      </div>
    </div>
  );
};

export default HealthPanel;
