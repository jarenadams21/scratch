# Configuration System

## Overview

All application flags and configuration values are managed through YAML/JSON files in the `/config` directory. This provides a single source of truth for both frontend and backend.

## Files

### Primary Configuration
- **[flags.yml](../config/flags.yml)** - Source of truth (human-readable)
- **[flags.json](../config/flags.json)** - Runtime config (browser-compatible)

Both files contain the same data. Edit YAML, then rebuild to JSON if needed.

## Flag Categories

### Development Mode (`dev`)
```yaml
dev:
  enabled: true
  mock_user: "admin@harbinger.dev"
  mock_token: "mock-dev-token-12345"
  simulated_delay_ms: 300
```

### Debug Mode (`debug`)
```yaml
debug:
  enabled: false
```

### Logging (`logging`)
```yaml
logging:
  log_level: "INFO"
  log_to_console: true
  log_messages: true
```

### API (`api`)
```yaml
api:
  base_url: "http://localhost:3000"
  timeout_ms: 30000
  retry_attempts: 3
```

### UI (`ui`)
```yaml
ui:
  show_dev_badges: true
  auto_save_interval_ms: 60000
  max_title_length: 100
  max_content_length: 10000
```

### Database (`database`)
```yaml
database:
  table_name: "journal-app"
  region: "us-east-1"
```

### Authentication (`auth`)
```yaml
auth:
  jwt_expires_in: "7d"
  require_email_verification: false
```

## Usage

### Frontend

```typescript
import { CONFIG, FLAGS, devLog, debugLog } from './types/FLAGS.js';

// Simple boolean checks
if (FLAGS.DEV) { /* ... */ }
if (FLAGS.DEBUG) { /* ... */ }

// Full configuration access
const apiUrl = CONFIG.API_URL;
const timeout = CONFIG.API_TIMEOUT;
const dbTable = CONFIG.DB_TABLE;

// Helpers
devLog('This only logs in DEV mode');
debugLog('This only logs in DEBUG mode');
```

### Backend

```javascript
import { config } from './config.js';

console.log(config.DYNAMODB_TABLE);
console.log(config.AWS_REGION);
console.log(config.DEV_MODE);
```

## Modifying Configuration

1. Edit `config/flags.yml`
2. If using JSON: regenerate `config/flags.json` (or edit directly)
3. TypeScript will auto-load changes on rebuild
4. Restart backend if needed

## Environment Overrides

Backend supports environment variable overrides:

```bash
# Override flags
DEV_MODE=false npm run dev
DEBUG=true npm run dev

# Override AWS settings
AWS_REGION=us-west-2 npm run dev
DYNAMODB_TABLE=custom-table npm run dev
```

Frontend loads config at build time, so edit `config/flags.json` directly or rebuild.

## Flag Access Patterns

### Type Safety
```typescript
// FLAGS provides simple booleans (backward compatible)
FLAGS.DEV      // boolean
FLAGS.DEBUG    // boolean
FLAGS.VERBOSE  // boolean

// CONFIG provides all settings with types
CONFIG.API_URL            // string
CONFIG.MAX_TITLE_LENGTH   // number
CONFIG.DEV_DELAY          // number
```

### Helpers
```typescript
import { isDev, isDebug, devLog, debugLog } from './types/FLAGS.js';

if (isDev()) {
  devLog('Development mode active');
}

if (isDebug()) {
  debugLog('Extra logging enabled');
}
```

## Production Checklist

Before deploying:

```yaml
dev:
  enabled: false  # ← Disable DEV mode

debug:
  enabled: false  # ← Disable DEBUG mode

api:
  base_url: "https://your-api.com"  # ← Update API URL

ui:
  show_dev_badges: false  # ← Hide dev indicators
```

Then:
1. Rebuild frontend
2. Redeploy with new config
3. Verify `[DEV]` badges don't appear

## Adding New Flags

1. Add to `config/flags.yml`:
```yaml
feature:
  new_feature_enabled: true
  description: "Enable new feature"
```

2. Update `types/FLAGS.ts`:
```typescript
export const CONFIG = {
  // ... existing
  NEW_FEATURE: flagsConfig.feature.new_feature_enabled,
};
```

3. Use in code:
```typescript
if (CONFIG.NEW_FEATURE) {
  // feature code
}
```
