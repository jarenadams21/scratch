# Start Harbinger

## Single Command Start

```bash
npm run dev
```

That's it! This will:
- ✅ Load config from `flags.yml` → `flags.json`
- ✅ Start frontend on http://localhost:8080
- ✅ Start backend on http://localhost:3000
- ✅ Auto-reload on file changes

## First Time Setup

```bash
# Install all dependencies
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd scripts && npm install && cd ..

# Start everything
npm run dev
```

## What You'll See

```
📦 Loading configuration...
✅ Configuration loaded from flags.yml
   DEV mode: true
   DEBUG: false
   API URL: http://localhost:3000
   DB Table: journal-app

[frontend] 🎨 Frontend: http://localhost:8080
[frontend]    Watching TypeScript files for changes...
[backend] 🚀 Backend: http://localhost:3000
[backend]    DEV mode: ON
[backend]    DB Table: journal-app
```

## Access

Visit http://localhost:8080 in your browser.

If `DEV mode: true` (default), you'll be auto-logged in with mock data.

## Override Config

```bash
# Disable DEV mode (use real backend)
DEV_MODE=false npm run dev

# Different API URL
API_URL=http://localhost:4000 npm run dev

# Multiple overrides
DEV_MODE=false DEBUG=true npm run dev
```

## Stop

Press `Ctrl+C` in the terminal to stop both servers.

## Individual Servers

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

See [RUNNING.md](RUNNING.md) for full documentation.
