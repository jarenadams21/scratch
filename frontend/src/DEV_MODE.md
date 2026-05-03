# DEV Mode

## Overview

DEV mode allows you to work on Harbinger's UI without needing a running backend or AWS DynamoDB. All operations are mocked locally with fake data.

## Enabling DEV Mode

In [types/FLAGS.ts](../types/FLAGS.ts):

```typescript
export const FLAGS = {
    DEBUG: false,
    VERBOSE: false,
    DEV: true  // Set to false for production
}
```

## What Happens in DEV Mode

### Auto-Login
- Automatically logs in as `admin@harbinger.dev`
- No password required
- Token stored as `mock-dev-token-12345`

### Mock Data
- 4 pre-populated journal entries
- All CRUD operations work locally:
  - **GET** posts - Returns mock entries
  - **CREATE** post - Adds to local array
  - **DELETE** post - Removes from local array
- No network calls made
- 300ms simulated delay for realism

### Visual Indicators
- `[DEV MODE - MOCK DATA]` badge on login screen
- `[DEV]` indicator in header navigation
- Console logs: `[DEV MODE] Mock message: <command>`

## Mock Data Location

[frontend/src/mock-data.js](mock-data.js)

Sample entries include topics on:
- Typewriter aesthetics
- Typography history
- Editorial standards
- Signal vs noise

## Switching to Production

1. Set `FLAGS.DEV = false` in FLAGS.ts
2. Start backend: `cd backend && npm run dev`
3. Ensure DynamoDB table exists
4. Refresh frontend

All network calls will route to `http://localhost:3000/msg`

## Use Cases

- UI development without backend
- Design iteration
- Demo/presentation mode
- Testing frontend logic
- Onboarding new developers

## Implementation

**[api.js](api.js)** checks `FLAGS.DEV` before every message:
```javascript
if (FLAGS.DEV) {
  console.log('[DEV MODE] Mock message:', message.command);
  return mockDB.createPost(title, content, mood);
}
// else: actual fetch() call
```

**[harbinger.js](harbinger.js)** auto-authenticates on load:
```javascript
if (FLAGS.DEV && !isLoggedIn()) {
  localStorage.setItem('authToken', MOCK_USER.token);
}
```
