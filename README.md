# stack

Custom fiber-reconciler vdom engine, message-based API transport with visitor dispatch, runtime feature flags. No React. No framework.

## Run

```bash
cd frontend && npm install && npm run dev   # dev server :8080
cd backend  && npm install && npm run dev   # api server :3000
```

## Dev mode

Set `dev.enabled: true` in `config/flags.json` to run against mock data with no backend.

## Core

| Path | Purpose |
|---|---|
| `frontend/src/engine/main.tsx` | Custom vdom + fiber reconciler |
| `frontend/src/lib/state.js` | Single-source state, subscriber re-render |
| `frontend/src/lib/api.js` | Visitor-pattern message transport |
| `frontend/src/types/messages.js` | Command/message envelope pattern |
| `backend/server.js` | Serverless-http command dispatcher (Lambda-compatible) |