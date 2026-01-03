<!-- docs/public/02_states/00_states.md -->
# States (Health Slice + UI Layout)

## Overview
This chapter introduces the in-memory slices used by the UI. Health is served from `/api/health`, while `/api/ui/layout` stores dashboard panel layout so positions/sizes survive reloads.

## What was built
- Central health slice under `backend/states`.
- Shared health builder that updates the slice for `/api/health`.
- Frontend state store with a health slice for UI hydration.
- Dashboard Health panel hydrates from `/api/health`.
- UI layout slice under `backend/states` with `GET/POST/PATCH /api/ui/layout`.
- Frontend UI layout cache + React Grid Layout persistence for panel position/size/visibility.

## How to run
Dev:
1) Install deps: `npm install`
2) Start backend: `npm run start`
3) Open `http://localhost:3000/` (UI), `http://localhost:3000/api/ui/layout`, or `http://localhost:3000/api/health`

## Layout stability check
- Run: `node scripts/tests/e2e/layout-stability.mjs`
- Result: `scripts/tests/e2e/layout-stability.result.json`

## Notes
- Backend in-memory state survives UI refresh (F5) but resets on backend restart.
- Health panel polling uses `/api/health` for status.
- UI layout is cached in local storage to avoid layout jumps on reload; server state is the source of truth.

## Files created/updated (what and why)
- `package.json`: Added Playwright devDependencies for UI smoke/layout checks.
- `backend/index.ts`: Added a startup cleanup prompt to kill stale Node processes before boot (avoids port conflicts).
- `backend/states/health.state.ts`: Added the in-memory health slice with controlled getters/setters for `ok`, `serverTimeUtc`, and `lastCheckedAtUtc`.
- `backend/states/ui.state.ts`: Added the in-memory UI layout slice with panel layout map + last update timestamp.
- `backend/state-services/health.service.ts`: Added the shared health builder/refresher that updates the health slice on `/api/health` reads.
- `backend/state-services/ui.service.ts`: Added UI layout snapshot + replace/upsert helpers for `/api/ui/layout`.
- `backend/server/http/routes/health/health.route.ts`: Health response now uses the health slice. Version removed.
- `backend/server/http/routes/ui/ui.route.ts`: Added `/api/ui/layout` GET/POST/PATCH routes with schema validation and payload parsing.
- `backend/server/http/routes/health/health.schemas.ts`: Health response schema trimmed to `ok` + `serverTimeUtc` (removed `version`).
- `backend/server/http/routes/ui/ui.schemas.ts`: Added Zod schemas + DTOs for UI layout payloads and response shaping.
- `backend/server/http/index.ts`: Registers the UI layout routes so `/api/ui/layout` is served alongside health and docs.
- `backend/server/http/routes/docs/docs.route.ts`: OpenAPI doc updated to reflect current health schema and the new `/api/ui/layout` endpoints (GET/POST/PATCH).
- `frontend/api/httpClient.ts`: Added shared `postJson` and `patchJson` helpers used by the UI layout API.
- `frontend/api/routes/health.api.ts`: Added a typed health client for fetching `/api/health`.
- `frontend/api/routes/uiLayout.api.ts`: Added typed helpers for fetching and persisting `/api/ui/layout`.
- `frontend/state/health.slice.ts`: Added a health slice reducer + hydration helper that maps `/api/health` into store state.
- `frontend/state/uiLayout.slice.ts`: Added UI layout slice that hydrates from localStorage and keeps the in-memory slice in sync per panel.
- `frontend/state/store.ts`: Added a lightweight store that wires the health + UI layout slices and exposes selector hooks.
- `frontend/query/health.queries.ts`: Updated health query to hydrate the store and use the new routed health client.
- `frontend/query/uiLayout.queries.ts`: Added UI layout query/mutation hooks that hydrate the UI layout slice.
- `frontend/main.tsx`: Preloads `/api/ui/layout` before rendering so the grid hydrates with the persisted layout on first paint.
- `frontend/pages/DashboardPage.tsx`: Reworked the grid to hydrate from the UI layout slice, persist drag/resize/visibility changes, and measure container width for stable positioning.
- `frontend/features/dashboard/panels/HealthPanel.tsx`: Reads health from the store (lastCheckedAtUtc), disables polling when collapsed, and improves panel scroll/resize behavior.
- `frontend/styles/tailwind.css`: Stabilized scrollbar width and added grid placeholder + drag cursor styling to improve layout feedback.
- `scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.js`: Updated health validation to match `{ ok, serverTimeUtc }` (version removed).
- `scripts/tests/smoke/01_nodejs_infrastructure/00_health.smoke.result.json`: Updated the sample output to match the trimmed health payload.
- `scripts/tests/smoke/02_states/00_state_snapshot.smoke.js`: Added a Playwright UI smoke that drags, collapses, hides, and reloads the dashboard panel while checking `/api/ui/layout`.
- `docs/public/00_overview/00_tech_stack.md`: Documented Playwright in the tech stack for UI smoke and layout stability checks.
- `docs/public/01_nodejs_infrastructure/00_nodejs_infrastructure.md`: Updated health endpoint examples to match the current `{ ok, serverTimeUtc }` payload.
- `docs/public/02_states/00_states.md`: Added the states chapter covering health/UI layout slices and related smoke checks.