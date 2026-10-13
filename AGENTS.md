# orquestador-agentes

## Overview
A Vite + Three.js single-page app. No backend, no database, no external APIs.
The "Nara" agent interprets Spanish text commands via local regex matching (`src/interpret.js`) — no AI/LLM calls.

## Development
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
App is served on host port 3000 (mapped from Vite's 5173 inside the container).

## Stack
- Vite 6.3.5 dev server, Three.js 0.170.0
- Node 22 (node:22-slim base image)
- npm (package-lock.json present; `npm ci` for installs)

## Testing
```bash
npm test   # node --test (unit tests for geometry/interpret/terrain-math)
```

## Notes
- Source is bind-mounted into the container; edits hot-reload via Vite HMR.
- No secrets or external credentials required.
