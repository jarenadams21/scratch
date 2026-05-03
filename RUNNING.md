# Running Harbinger

## Quick Start

From the root directory:

```bash
# Install dependencies (first time only)
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd scripts && npm install && cd ..

# Start both frontend and backend
npm run dev
```

This will:
1. Load config from `config/flags.yml` → `config/flags.json`
2. Start frontend on http://localhost:8080
3. Start backend on http://localhost:3000
4. Watch for TypeScript changes
5. Watch for backend changes (auto-restart)

## Available Commands

### Development
```bash
npm run dev              # Start both servers with config reload
npm run dev:frontend     # Frontend only (port 8080)
npm run dev:backend      # Backend only (port 3000)
npm run load-config      # Reload config from YAML
```

### Production
```bash
npm run build            # Build both
npm start                # Start both (production mode)
```

## Environment Variables

Override config at runtime:

```bash
# Development mode off
DEV_MODE=false npm run dev

# Debug mode on
DEBUG=true npm run dev

# Custom API URL
API_URL=https://api.prod.com npm run dev

# Multiple overrides
DEV_MODE=false API_URL=http://localhost:4000 npm run dev
```

## Config Loading Process

1. **Startup**: `npm run dev` runs `load-config.js`
2. **Load YAML**: Reads `config/flags.yml`
3. **Apply Env Vars**: Merges environment variable overrides
4. **Generate JSON**: Writes `config/flags.json`
5. **Start Servers**: Both frontend and backend import `flags.json`

### Output Example
```
📦 Loading configuration...
✅ Configuration loaded from flags.yml
   DEV mode: true
   DEBUG: false
   API URL: http://localhost:3000
   DB Table: journal-app

🎨 Frontend: http://localhost:8080
   Watching TypeScript files for changes...
🚀 Backend: http://localhost:3000
   DEV mode: ON
   DB Table: journal-app
```

## Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 8080 | http://localhost:8080 |
| Backend | 3000 | http://localhost:3000 |

## Changing Config

### Method 1: Edit YAML (Recommended)
```bash
# Edit config/flags.yml
vim config/flags.yml

# Restart to reload
npm run dev
```

### Method 2: Environment Variables
```bash
# Temporary override for this session
DEV_MODE=false npm run dev
```

### Method 3: Edit JSON Directly
```bash
# Edit config/flags.json (overwrites on next load-config run)
vim config/flags.json
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill

# Kill process on port 3000
lsof -ti:3000 | xargs kill
```

### Config Not Loading
```bash
# Manually reload config
npm run load-config

# Check config file exists
ls -la config/flags.json
```

### Backend Won't Start
```bash
# Check if DynamoDB table exists (if not in DEV mode)
aws dynamodb describe-table --table-name journal-app

# Or enable DEV mode
echo "dev:\n  enabled: true" >> config/flags.yml
npm run load-config
npm run dev:backend
```

## Development Workflow

1. **Start servers**: `npm run dev`
2. **Edit code**: Changes auto-reload
3. **Edit config**: Restart servers to apply
4. **View logs**: Both servers output to same terminal (with prefixes)

## Production Deployment

1. Update config for production:
```yaml
dev:
  enabled: false
api:
  base_url: "https://your-api.com"
```

2. Build:
```bash
npm run build
```

3. Deploy built artifacts to your hosting provider
