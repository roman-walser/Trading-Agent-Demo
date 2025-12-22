<!-- docs/public/01_nodejs_infrastructure/00_nodejs_infrastructure.md -->
# Node.js Infrastructure

## Overview
Minimal Node.js backend with env-driven config, Fastify HTTP, and Socket.IO on the same port. `/health` and `/api/health` return `{ ok, serverTimeUtc, version }`; graceful shutdown covers HTTP + WS. In prod mode the backend serves the built Vite dashboard at `/` (assets under `/assets/`). Only the health routes are exposed in this chapter; further APIs come later.

## Purpose
- Provide a predictable entrypoint for future runtime, state, and provider services
- Centralize config loading (`PORT`, `LOG_LEVEL`, `WS_PATH`) so downstream modules stay lean
- Ensure health, WS transport, and shutdown behavior are consistent before adding complexity

## What was built
- ESM Node.js backend with `npm run start` (dev) and `npm run start:prod` (serve built frontend)
- Config loader for `PORT`, `LOG_LEVEL`, `WS_PATH` with sane defaults from `.env`
- Fastify server exposing `/health` and `/api/health`, attached Socket.IO transport, handling `SIGINT`/`SIGTERM` cleanly
- Static serving of the Vite-built dashboard (`npm run build`) at `/` with assets under `/assets/`
- Git hygiene for local env/data/log artifacts

## Dashboard panel UX (health panel)
- Collapsible/expandable health panel with smooth height/opacity transition and horizontal-only resize when collapsed (full SE resize when expanded).
- Resize handle redesigned als dezente Ecke ohne Icon, naeher an der Panel-Ecke platziert.
- Header is not selectable; text selection is limited to the panel body to prevent cross-page selection.
- Reusable Styling- und Verhalten-Pattern fuer kommende Panels; aktueller Screenshot: `docs/public/01_nodejs_infrastructure/00_UI_DashboardPage_and_ServerHealth_Panel.png`.

## API routes (in this chapter)
- `GET /health`  `{ ok, serverTimeUtc, version }` (plain health probe).
- `GET /api/health`  `{ ok, serverTimeUtc, version }` (API-prefixed health).
- `WS_PATH` (default `/ws`) via Socket.IO on the same port as HTTP.
- Static frontend: `GET /` serves the built dashboard; assets under `/assets/*`.

### API docs (Swagger UI)
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/openapi.json`

## How to run
Dev:
1) Install deps: `npm install`
2) Start backend: `npm run start`
3) Open `http://localhost:3000/api/health` or `/health`

Prod serve (built frontend + API/WS on one port):
1) Build: `npm run build`
2) Serve: `npm run start:prod`
3) Open `http://localhost:3000/` (UI) and `http://localhost:3000/api/health`
4) Stop with `Ctrl+C` to exercise graceful shutdown

## Smoke test
- Run: `npm test` (or `node scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.js`)
- Checks: HTTP `/health` + `/api/health` shape, WS connect, static frontend (`/` + built asset), optional backend spawn (`SMOKE_SPAWN_BACKEND=false` to reuse running server)
- Latest run: `2025-12-22T05:50:21.496Z` -> `scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.result.json`

## Docker quickstart
- Build: `docker build -t trading-agent-demo .`
- Run: `docker run --rm -p 3000:3000 trading-agent-demo`
- UI: `http://localhost:3000/` | API: `http://localhost:3000/api/health`

## Stack & rationale
- **Node.js + ESM + TypeScript baseline**: Modern tooling/typing, unified stack across backend/frontend.
- **Fastify (HTTP)**: Slim, fast HTTP server with a clear plugin model and strong typing; minimal footprint for health/API.
- **Socket.IO (WS)**: Robust WebSocket transport with reconnect/multiplexing, sharing the HTTP port.
- **Vite + React**: Fast dev/build for the dashboard; React for modular panels.
- **Tailwind CSS**: Utility-first styling for the dashboard shell, header, and panels.
- **React Query**: Server-state management (health polling), cleanly separated from UI logic.
- **Zod**: Schema validation at API boundaries (health response shape in backend/tests).
- **tsx**: Fast TS runner for dev/prod start without a separate backend build step.

## Files created/updated (what and why)
- `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`: Baseline project config, scripts, typing, env defaults, and ignore rules.
- `backend/config/app.config.ts`: Load `PORT`, `LOG_LEVEL`, `WS_PATH` from env with sane defaults.
- `backend/index.ts`: Bootstrap Fastify + Socket.IO, start/stop hooks, graceful shutdown.
- `backend/server/http/index.ts`: Fastify setup, health routes, static serving of built frontend, not-found handling.
- `backend/server/http/routes/health/*`: Health endpoints and schema definition for predictable responses.
- `backend/server/ws/index.ts`: Attach Socket.IO transport and basic connect/disconnect logging.
- `frontend/index.html`, `frontend/main.tsx`, `frontend/pages/DashboardPage.tsx`: Vite entry + React dashboard shell.
- `frontend/features/dashboard/panels/HealthPanel.tsx`: UI for HTTP/WS status, polling info, sources.
- `frontend/api/httpClient.ts`, `frontend/api/wsClient.ts`, `frontend/api/health.api.ts`: HTTP/WS clients and health fetch.
- `frontend/query/health.queries.ts`: React Query wrapper for health polling.
- `frontend/config/polling.config.ts`: Central polling interval.
- `frontend/styles/*`: Global/dashboard/panel styling for the health UI.
- `frontend/vite-env.d.ts`, `vite.config.ts`: Vite/TypeScript integration and build output location.
- `scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.js`: Smoke test for HTTP, WS, and static frontend.
- `README.md`: How to run dev/prod, smoke tests, Docker usage.
- `Dockerfile`, `.dockerignore`: Container build/run for one-port API/WS + frontend.
