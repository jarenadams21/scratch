# Harbinger CLI Commands

Quick reference for all available commands.

## Development

### Start Everything
```bash
npm run dev
```
Loads config, starts both frontend and backend with auto-reload.

### Individual Servers
```bash
npm run dev:frontend    # Port 8080
npm run dev:backend     # Port 3000
```

### Config Management
```bash
npm run load-config     # Reload YAML → JSON
```

## Environment Overrides

```bash
# DEV mode off
DEV_MODE=false npm run dev

# Debug output
DEBUG=true npm run dev

# Custom API
API_URL=https://api.prod.com npm run dev

# Different database
DB_TABLE=journal-prod DB_REGION=us-west-2 npm run dev
```

## Production

```bash
npm run build           # Build both
npm start               # Start production servers
```

## Quick Scripts

```bash
./start.sh              # Auto-install deps + start dev
```

## Component Commands

### Frontend
```bash
cd frontend
npm run dev             # Start dev server (port 8080)
npm run build           # Build TypeScript
```

### Backend
```bash
cd backend
npm run dev             # Start with auto-reload
npm start               # Start production
```

### Scripts
```bash
cd scripts
node load-config.js     # Manually load config
```

## Validation

```bash
cd scripts
ts-node validate-logging.ts    # Check LOG_WITH_LEVEL usage
```

## Port Reference

| Service | Port | Command |
|---------|------|---------|
| Frontend | 8080 | `npm run dev:frontend` |
| Backend | 3000 | `npm run dev:backend` |

## Common Workflows

### First Time Setup
```bash
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd scripts && npm install && cd ..
npm run dev
```

### Daily Development
```bash
npm run dev
# Edit code, changes auto-reload
```

### Change Configuration
```bash
# Edit config/flags.yml
vim config/flags.yml

# Restart to apply
^C
npm run dev
```

### Production Build
```bash
# Update config for prod
vim config/flags.yml
# Set dev.enabled: false
# Set api.base_url: production URL

npm run build
npm start
```

## Troubleshooting

### Port in Use
```bash
lsof -ti:8080 | xargs kill
lsof -ti:3000 | xargs kill
```

### Config Issues
```bash
# Check generated config
cat config/flags.json

# Regenerate
npm run load-config
```

### Full Reset
```bash
# Clean and reinstall
rm -rf node_modules frontend/node_modules backend/node_modules scripts/node_modules
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd scripts && npm install && cd ..
```
