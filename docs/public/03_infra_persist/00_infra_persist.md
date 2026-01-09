<!-- docs/public/03_infra_persist/00_infra_persist.md -->
# Infra Persist (UI Layout)

## Overview
This chapter persists the dashboard UI layout and restores it on backend restart. The UI still reads `/api/ui/layout`; the backend writes snapshots through a persistence adapter (NDJSON or MySQL).

## What was built
- UI layout persistence repo with adapter selection (`ndjson` or `mysql`).
- NDJSON snapshots at `backend/data/ui-layout.ndjson` (append-only, last snapshot used).
- Layout presets stored in `backend/data/ui-layout-presets.json` (NDJSON adapter).
- MySQL table `ui_layout_snapshots` (payload stored as JSON).
- MySQL table `ui_layout_presets` (payload stored as JSON).
- Bootstrap hydration on server start, plus graceful MySQL pool shutdown.
- Schema versioning on snapshots for forward compatibility.
- Header layout menu (click to open) for history navigation (back/forward), default layout, clearing history, and a Panels submenu.
- History snapshots loaded from persistence (`/api/ui/layout/history`) so navigation survives refresh.
- Layout presets saved via a Layouts submenu (create/rename/delete/apply).

## Configuration
Set in `.env` / `.env.example`:
- `UI_PERSIST_ADAPTER=ndjson|mysql` (default `ndjson`)
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`

## Smoke test
- Run: `node scripts/tests/smoke/03_infra_persist/00_ui_layout_persist.smoke.js`
- Output: `scripts/tests/smoke/03_infra_persist/00_ui_layout_persist.smoke.result.json`
- Run: `node --import tsx scripts/tests/smoke/03_infra_persist/01_ui_layout_history.smoke.js`
- Output: `scripts/tests/smoke/03_infra_persist/01_ui_layout_history.smoke.result.json`
- Run: `node scripts/tests/smoke/03_infra_persist/02_ui_layout_presets.smoke.js`
- Output: `scripts/tests/smoke/03_infra_persist/02_ui_layout_presets.smoke.result.json`

## Notes
- UI layout state and persistence stay in sync (last-write-wins).
- Invalid NDJSON lines are skipped on load.
- Layout history uses last-write-wins snapshots and keeps server + UI in sync.
- History can be cleared via `DELETE /api/ui/layout/history` (current layout retained).
- History past is reconstructed from persisted snapshots after reload; forward history rebuilds after back navigation.
- No new UI panel was added in this chapter.
- Saved layouts are stored via `GET/POST/PATCH/DELETE /api/ui/layouts`.

## Files created/updated (what and why)
- `.env.example`: Adds adapter selection and MySQL connection defaults for persistence.
- `README.md`: Documents the new infra persist chapter and smoke test entrypoint.
- `backend/config/app.config.ts`: Parses persistence env vars and exposes adapter config.
- `backend/index.ts`: Boot hydration from persistence and adapter shutdown on exit.
- `backend/server/http/routes/ui/ui.route.ts`: Adds layout history endpoints (list + clear) plus layout preset CRUD endpoints.
- `backend/server/http/routes/ui/ui.schemas.ts`: Reuses shared UI layout schemas to keep API and persistence in sync.
- `backend/state-services/ui.service.ts`: Persists layout snapshots on POST/PATCH and adds saved layout preset helpers.
- `docs/public/02_states/00_states.md`: Notes that layout persistence is covered in this chapter.
- `docs/public/03_infra_persist/00_infra_persist.md`: Adds layout history and smoke test updates for this chapter.
- `frontend/api/httpClient.ts`: Adds DELETE helper for history cleanup requests.
- `frontend/api/routes/uiLayout.api.ts`: Adds history fetch + clear APIs plus layout preset endpoints.
- `frontend/features/dashboard/components/PageHeader.tsx`: Adds a click-open layout menu with history actions, Layouts submenu, and Panels submenu.
- `frontend/pages/DashboardPage.tsx`: Wires layout history navigation, default layout, history clearing, and layout preset actions.
- `frontend/query/uiLayout.queries.ts`: Loads persisted history, records layout history on writes, and adds preset list + mutations.
- `frontend/state/store.ts`: Exposes layout history selectors/actions for UI + smoke tests.
- `frontend/state/uiLayout.slice.ts`: Stores layout history stacks, navigation helpers, and default layout helpers.
- `package-lock.json`: Updates the dependency lock for the MySQL adapter.
- `package.json`: Adds `mysql2` dependency for the MySQL adapter.
- `backend/infra/persist/uiLayout.repo.ts`: Implements NDJSON/MySQL adapter, schema versioning, history reads, history reset, and layout presets.
- `backend/state-services/ui.schema.ts`: Centralized Zod schemas for UI layout payload/state and layout presets.
- `scripts/tests/smoke/03_infra_persist/00_ui_layout_persist.smoke.js`: Comprehensive persistence smoke test (write, restart, validate).
- `scripts/tests/smoke/03_infra_persist/00_ui_layout_persist.smoke.result.json`: Latest smoke result snapshot for review.
- `scripts/tests/smoke/03_infra_persist/01_ui_layout_history.smoke.js`: Smoke test for layout history back/forward.
- `scripts/tests/smoke/03_infra_persist/01_ui_layout_history.smoke.result.json`: Latest layout history smoke result snapshot.
- `scripts/tests/smoke/03_infra_persist/02_ui_layout_presets.smoke.js`: Smoke test for layout presets (create/rename/delete).
- `scripts/tests/smoke/03_infra_persist/02_ui_layout_presets.smoke.result.json`: Latest layout presets smoke result snapshot.
- `scripts/tests/smoke/02_states/00_state_snapshot.smoke.js`: Extends the UI smoke flow with back/forward, default layout, delete history, and post-reload checks.
- `scripts/tests/smoke/02_states/00_state_snapshot.smoke.result.json`: Latest state snapshot smoke output including history navigation results.
