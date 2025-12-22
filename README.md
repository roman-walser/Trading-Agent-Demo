<!-- README.md -->
# Trading Agent Demo (Node.js Infra)

Minimal HTTP + WebSocket baseline in TypeScript:
- Fastify HTTP server with `/health` and `/api/health`
- Socket.IO transport attached to the same server
- Vite + React dashboard with a Health panel (HTTP poll + WS status); panels live in a draggable grid, can be shown/hidden, and collapse/expand

![UI DashboardPage and ServerHealth Panel](docs/public/01_nodejs_infrastructure/00_UI_DashboardPage_and_ServerHealth_Panel.png)

## Chapters
- [Project status](#project-status)
- [Docs](#docs)
- [Getting started](#getting-started)
- [Smoke test (Roadmap 00)](#smoke-test-roadmap-00)
- [Production build & serve](#production-build--serve)
- [Docker (one-port API/WS + frontend)](#docker-one-port-apiws--frontend)
- [Scripts](#scripts)

## Project status
This demo is an early baseline extracted from a larger, real-world project. It does not yet include the trading-agent domain logic, but it already reflects the architecture, workflow, and engineering standards used in the full build (HTTP/WS contracts, UI patterns, testing approach, and documentation style).

## Docs
- [Tech stack](docs/public/00_overview/00_tech_stack.md)
- [Tooling](docs/public/00_overview/01_tooling.md)
- [Node.js infrastructure](docs/public/01_nodejs_infrastructure/00_nodejs_infrastructure.md)

## Getting started
1. Install deps: `npm install`
2. Env: copy `.env.example` to `.env` (defaults use port 3000, log level `info`, WS path `/ws`)
3. Start backend (dev): `npm run start`
4. Start frontend (dev, separate terminal): `npm run dev:frontend` (opens Vite on 5173; API/WS base defaults to `http://localhost:3000`)

## Smoke test (Roadmap 00)
- Default spawns backend itself; set `SMOKE_SPAWN_BACKEND=false` to reuse a running one.
- Run: `npm test`
- Checks: HTTP `/health` + `/api/health` shape, WS connect, static frontend (`/` and first asset).
- Output: `scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.result.json`

## Production build & serve
- Build frontend + type-check: `npm run build` (outputs to `dist/frontend`)
- Serve built frontend + backend on `http://localhost:3000`: `npm run start:prod`
- In prod mode, the backend serves the built dashboard at `/` and assets under `/assets/`.

## Docker (one-port API/WS + frontend)
- Build image: `docker build -t trading-agent-demo .`
- Run: `docker run --rm -p 3000:3000 --env PORT=3000 trading-agent-demo`
- Open: `http://localhost:3000/` (UI) and `http://localhost:3000/api/health`

## Scripts
- `npm run start` — backend HTTP + Socket.IO
- `npm run dev:backend` — backend with reload (tsx watch)
- `npm run dev:frontend` — Vite dev server
- `npm run dev` — run backend + frontend together
- `npm run build` — type-check + Vite build
- `npm run start:prod` — build + run backend serving the built frontend
- `npm test` — smoke test for health endpoints
