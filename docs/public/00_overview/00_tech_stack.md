# Technology Stack

## Overview

**Backend**
- Node.js + TypeScript
- Fastify (HTTP API)
- Zod (runtime validation & API contracts)
- OpenAPI / Swagger (API documentation)
- Pino (structured logging)
- Vitest (unit/integration testing)
- ESLint + Prettier (linting & formatting)
- TypeScript strict configuration (type-safety baseline)
- Socket.IO (real-time push transport for live status/events)

**Frontend**
- Vite + React + TypeScript
- React Query (server-state management)
- Tailwind CSS (utility-first styling)
- Vitest + React Testing Library (UI testing)
- Playwright (UI smoke and layout stability checks)
- ESLint + Prettier (linting & formatting)
- openapi-typescript (shared API types generated from OpenAPI)
- socket.io-client (real-time subscription for live status/events)

---

## Why these choices

### Backend

**Node.js + TypeScript**  
Node.js enables a unified JavaScript/TypeScript ecosystem across backend and frontend.  
TypeScript adds static typing, improved tooling, and early error detection without complicating the runtime architecture.

**Fastify (HTTP API)**  
Fastify is a lightweight, high-performance HTTP framework with a clear plugin model and excellent TypeScript support.  
It stays focused on transport and request handling and does not impose domain or application architecture constraints.

**Zod (runtime validation & API contracts)**  
Zod is used explicitly at system boundaries (API inputs, optional response validation, external data ingestion).  
It ensures runtime validation and normalization of data while allowing TypeScript types to be derived from the same schemas.

**OpenAPI / Swagger (API documentation)**  
OpenAPI provides a formal, machine-readable description of the HTTP API and serves as a stable contract between backend and frontend.  
Swagger UI enables interactive API documentation for development, testing, and integration.

**Socket.IO (real-time push transport)**  
Socket.IO provides a robust real-time channel for low-latency UI updates (e.g., runtime status, ticks, warnings, event tails).  
It supports connection lifecycle management (reconnects, heartbeats), stable event naming, and multiplexing multiple update streams over a single connection.  
Socket.IO is used for **live, small, frequent, on-change** data surfaces and complements HTTP endpoints that remain the canonical contract layer.

**Pino (structured logging)**  
Pino provides fast, structured logging suitable for both local development and production-like environments.  
Logs are machine-readable and can be integrated into centralized observability or monitoring stacks if needed.

**Vitest (testing)**  
Vitest provides fast, TypeScript-friendly test execution for backend units and integration tests with minimal configuration overhead.

**ESLint + Prettier (linting & formatting)**  
ESLint enforces code-quality rules while Prettier ensures consistent formatting.  
Together they reduce style-related review noise and make the codebase more maintainable.

**TypeScript strict configuration**  
A strict TypeScript baseline (e.g., `strict: true`) reduces runtime surprises by catching type issues early and enforcing more explicit code.

---

### Frontend

**Vite + React + TypeScript**  
Vite offers a fast development server and a modern build pipeline with minimal configuration.  
React is well suited for component-based dashboards with many independent panels and clear lifecycle boundaries.  
TypeScript ensures robust typing and predictable data flows in the UI layer.

**React Query (server-state management)**  
React Query handles server data fetching, caching, polling, and synchronization in the frontend.  
It clearly separates server-state from UI-state and reduces the need for custom data-fetching and cache logic.

**socket.io-client (real-time subscriptions)**  
socket.io-client enables the UI to subscribe to live backend updates (e.g., `runtime.status`) without polling overhead.  
It integrates cleanly with a dedicated, minimal “live status” state slice and can be combined with HTTP/React Query as a fallback when the real-time channel is unavailable.

**Tailwind CSS (utility-first styling)**  
Tailwind CSS enables rapid, consistent styling without complex CSS architectures or global side effects.  
The utility-first approach is particularly effective for dashboards and data-driven UIs with reusable layout patterns.

**Vitest + React Testing Library (UI testing)**  
Vitest provides fast test execution, while React Testing Library promotes user-centric component testing.  
This combination enables reliable UI tests without coupling to implementation details.

**Playwright (UI smoke testing)**  
Playwright powers the UI smoke checks that validate panel interactions (collapse/drag/reload) and layout stability across reloads.

**ESLint + Prettier (linting & formatting)**  
A consistent linting and formatting setup improves maintainability and supports rapid iteration in a UI codebase.

**openapi-typescript (generated API types)**  
openapi-typescript generates TypeScript types directly from the backend’s OpenAPI specification.  
This reduces contract drift between backend and frontend and improves safety and developer velocity.

---

## Notes

- The stack is intentionally **modular and framework-agnostic**.
- Backend business logic, state management, and persistence remain independent of the HTTP transport layer.
- Frontend and backend are clearly separated and communicate through defined API contracts (HTTP/OpenAPI) plus a dedicated real-time channel (Socket.IO).
- HTTP endpoints remain the stable, documented contract layer; Socket.IO is used for live status and event streaming.
- Future extensions (e.g., database-backed persistence, additional UI views, background workers) can be introduced without fundamental architectural changes.
