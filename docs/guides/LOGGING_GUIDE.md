# Logging System Guide

## Overview

This project uses a type-safe logging system that automatically validates filenames and provides consistent log formatting.

## Quick Start

### Recommended Approach: Create a Logger Instance

At the top of each file, create a logger instance:

```typescript
import { UTILITIES } from "./utilities";

// Create a logger for this file
const logger = UTILITIES.createLogger("my-file.ts");

// Use it anywhere in the file
export function myFunction() {
    logger.info({
        command: "myCommand",
        payload: { content: "Hello", num: someNum }
    });
}
```

**Benefits:**
- ✅ Filename is automatically attached
- ✅ No repetition
- ✅ Easy to maintain
- ✅ Type-safe

## Available Methods

### Logger Instance Methods

```typescript
const logger = UTILITIES.createLogger("my-file.ts");

// Available methods:
logger.info(message);    // Log informational message
logger.warn(message);    // Log warning
logger.error(message);   // Log error
logger.debug(message);   // Log debug information
logger.log(LOG_LEVEL.INFO, message); // Log with custom level
```

### Direct Logging

If you need to log without creating an instance:

```typescript
import { UTILITIES, LOG_LEVEL } from "./utilities";

UTILITIES.LOG_WITH_LEVEL("my-file.ts", LOG_LEVEL.INFO, message);
```

## Type Safety Features

### Filename Validation

The system only accepts valid source file names:
- ✅ `"file.ts"`
- ✅ `"component.tsx"`
- ✅ `"script.js"`
- ✅ `"module.jsx"`
- ❌ `"string"` (literal)
- ❌ `"file.txt"` (wrong extension)
- ❌ `"document.pdf"` (wrong extension)

### Log Output Format

```
[2026-05-02T10:30:45.123Z] [INFO] [my-file.ts] { command: "...", payload: {...} }
```

Includes:
- ISO timestamp
- Log level name
- Source filename
- Message content

## Pipeline Validation

### Running the Validator

```bash
# Validate all logging calls
ts-node scripts/validate-logging.ts
```

### CI/CD Integration

Add to `package.json`:

```json
{
  "scripts": {
    "validate:logs": "ts-node scripts/validate-logging.ts",
    "test": "npm run validate:logs && ..."
  }
}
```

Or in CI workflow:

```yaml
# .github/workflows/ci.yml
- name: Validate Logging
  run: npm run validate:logs
```

## Migration Guide

### Old Code

```typescript
UTILITIES.LOG_WITH_LEVEL("types.ts", LOG_LEVEL.INFO, message);
UTILITIES.LOG_WITH_LEVEL("types.ts", LOG_LEVEL.ERROR, errorMessage);
UTILITIES.LOG_WITH_LEVEL("types.ts", LOG_LEVEL.DEBUG, debugMessage);
```

### New Code

```typescript
// At top of file
const logger = UTILITIES.createLogger("types.ts");

// Usage in functions
logger.info(message);
logger.error(errorMessage);
logger.debug(debugMessage);
```

## Best Practices

1. **One logger per file**: Create a single logger instance at the top of each file
2. **Use descriptive commands**: Make the `command` field meaningful
3. **Include context in payload**: Add relevant data to help debugging
4. **Choose appropriate levels**:
   - `INFO`: Normal operation events
   - `WARN`: Potentially harmful situations
   - `ERROR`: Error events that might still allow the app to continue
   - `DEBUG`: Detailed information for debugging

## Examples

See [logging-examples.ts](./logging-examples.ts) for comprehensive examples.

## Troubleshooting

### Error: "Argument of type 'X' is not assignable to parameter of type..."

Make sure:
1. The filename has a valid extension (.ts, .tsx, .js, .jsx)
2. You're passing a string literal, not a variable
3. The filename matches the actual file

### Error: "Log level X is not valid"

Use the `LOG_LEVEL` enum:
```typescript
import { LOG_LEVEL } from "./utilities";

logger.log(LOG_LEVEL.INFO, message); // ✅
logger.log(5, message); // ❌
```
