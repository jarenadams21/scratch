# DEV Mode Quick Reference

## Toggle DEV Mode

**[types/FLAGS.ts](../../types/FLAGS.ts)**
```typescript
export const FLAGS = {
    DEV: true   // ← Set to false for production
}
```

## What You Get

### Instant Access
- No backend needed
- No DynamoDB required
- Auto-login on page load
- 4 pre-populated entries

### Visual Indicators
- Login: `[DEV MODE - MOCK DATA]` badge
- Header: `[DEV]` indicator
- Console: `[DEV MODE] Mock message: <command>` logs

### Mock Operations
All database operations work locally:
- ✅ Create posts
- ✅ View posts  
- ✅ Delete posts
- ✅ Simulated 300ms delay

### No Network
Zero `fetch()` calls. Everything stays in browser memory.

## Files

| File | Purpose |
|------|---------|
| [FLAGS.ts](../../types/FLAGS.ts) | Toggle DEV mode |
| [mock-data.js](mock-data.js) | Mock database & entries |
| [api.js](api.js) | Routes to mocks when DEV=true |
| [harbinger.js](harbinger.js) | Auto-login on DEV |
| [DEV_MODE.md](DEV_MODE.md) | Full documentation |

## Production Mode

```typescript
FLAGS.DEV = false
```

Then start backend:
```bash
cd backend
npm install
npm run dev
```

App will make real network calls to `http://localhost:3000/msg`
