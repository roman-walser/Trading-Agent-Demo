# Tooling

## Overview

> This section documents development tooling only. Runtime dependencies and architecture are described separately; see `00_tech_stack.md`.

**Editor**
- Visual Studio Code (primary IDE)

**Version control**
- Local GitLab server for day-to-day development and private repositories
- GitHub for public showcases and external applications

**AI assistance (Codex)**
- Used intentionally for bounded tasks (scaffolding, refactors, documentation, test ideation)
- All generated output is reviewed, adapted, and integrated manually; no blind copy/paste

---

## Why this workflow

**Visual Studio Code**  
Fast, extensible, and well suited for TypeScript/React and Node.js development within a single workspace.

**Local GitLab**  
Keeps daily development on local infrastructure, providing full control over access, history, and internal workflows.

**GitHub**  
Used for public-facing applications and for sharing selected work externally in a controlled manner.

**Codex (targeted use)**  
Used as a productivity accelerator for well-defined tasks. All generated output is validated against the project’s architecture, constraints, and coding standards before integration.
