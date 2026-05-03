# Config System - How It Works

## Overview

Harbinger uses a YAML-first configuration system that loads at runtime and can be overridden via environment variables.

## Flow

```
config/flags.yml              # Source of truth (edit this)
       ↓
scripts/load-config.js        # Parses YAML + applies env vars
       ↓
config/flags.json             # Generated runtime config
       ↓
types/FLAGS.ts                # Imports JSON, exports typed constants
       ↓
app code                      # Uses CONFIG.* constants
```

## Startup Sequence

When you run `npm run dev`:

1. **Load Config** (`npm run load-config`)
   - Reads `config/flags.yml`
   - Parses YAML to JavaScript object
   - Applies environment variable overrides
   - Writes `config/flags.json`
   - Displays config summary

2. **Start Frontend** (`npm run dev:frontend`)
   - Imports `config/flags.json` via `types/FLAGS.ts`
   - Uses `CONFIG.*` constants in code
   - Server starts on port 8080
   - If `CONFIG.DEV`: auto-login with mock data

3. **Start Backend** (`npm run dev:backend`)
   - Imports `config/flags.json` via `backend/config.js`
   - Uses `config.*` constants in code
   - Server starts on port 3000
   - If `config.DEV_MODE`: logs "DEV mode: ON"

## Config Access

### Frontend/TypeScript
```typescript
import { CONFIG, FLAGS } from './types/FLAGS.js';

// Boolean flags (simple)
if (FLAGS.DEV) { ... }

// Full config access
const url = CONFIG.API_URL;
const delay = CONFIG.DEV_DELAY;
```

### Backend/JavaScript
```javascript
import { config } from './config.js';

const table = config.DYNAMODB_TABLE;
const region = config.AWS_REGION;
const isDev = config.DEV_MODE;
```

## Environment Overrides

At runtime, you can override config values:

```bash
DEV_MODE=false DEBUG=true npm run dev
```

This:
1. Runs `load-config.js` with env vars set
2. Script reads YAML
3. Script applies overrides: `config.dev.enabled = false`
4. Script writes modified config to JSON
5. Servers start with overridden values

### Supported Overrides

| Env Var | Config Path | Example |
|---------|-------------|---------|
| `DEV_MODE` | `dev.enabled` | `DEV_MODE=false` |
| `DEBUG` | `debug.enabled` | `DEBUG=true` |
| `API_URL` | `api.base_url` | `API_URL=http://localhost:4000` |
| `DB_TABLE` | `database.table_name` | `DB_TABLE=journal-prod` |
| `DB_REGION` | `database.region` | `DB_REGION=us-west-2` |

## Adding New Config

### 1. Add to YAML
```yaml
# config/flags.yml
feature:
  new_setting: true
  description: "My new feature"
```

### 2. Update TypeScript Types
```typescript
// types/FLAGS.ts
export const CONFIG = {
  // ... existing
  NEW_SETTING: flagsConfig.feature.new_setting,
};
```

### 3. Update Backend (if needed)
```javascript
// backend/config.js
export const config = {
  // ... existing
  NEW_SETTING: flagsConfig.feature.new_setting,
};
```

### 4. Use in Code
```typescript
if (CONFIG.NEW_SETTING) {
  // feature code
}
```

### 5. Restart
```bash
npm run dev  # Config auto-reloads
```

## Runtime vs Build Time

### Runtime (Current System)
- Config loaded when servers start
- Change YAML → restart servers
- Env vars override at startup
- JSON generated fresh each time

### Build Time (Alternative)
- Config baked into bundle
- Change YAML → rebuild app
- Less flexible, smaller bundle
- Not currently used

Harbinger uses **runtime** configuration for flexibility.

## Config Validation

Currently, config values are used as-is. To add validation:

1. Add schema in `scripts/load-config.js`:
```javascript
if (config.dev.simulated_delay_ms < 0) {
  throw new Error('Delay must be positive');
}
```

2. Or use a validation library like `joi` or `zod`.

## Debugging Config

### Check Generated JSON
```bash
cat config/flags.json
```

### Verify Frontend Config
```typescript
// In browser console
console.log(CONFIG);
```

### Verify Backend Config
```javascript
// Add to backend/server.js
console.log('Config:', config);
```

### Trace Loading
```bash
# Run config loader manually
node scripts/load-config.js

# Check output
📦 Loading configuration...
✅ Configuration loaded from flags.yml
   DEV mode: true
   ...
```

## Best Practices

1. **Edit YAML, not JSON** - JSON is auto-generated
2. **Document flags** - Use `description` fields
3. **Test overrides** - Verify env vars work before deploying
4. **Version control** - Commit `flags.yml`, ignore `flags.json` if desired
5. **Production checklist** - Review all flags before deploy

## Production Deployment

Before deploying:

```yaml
# config/flags.yml
dev:
  enabled: false          # ← Disable DEV mode

debug:
  enabled: false          # ← Disable debug logs

api:
  base_url: "https://api.prod.com"  # ← Production API

ui:
  show_dev_badges: false  # ← Hide dev indicators
```

Then:
```bash
npm run load-config
npm run build
# Deploy
```

Or use env vars in production:
```bash
DEV_MODE=false DEBUG=false npm start
```
