# Custom JSX Build System - No React

## What This Is

**Zero React dependencies** - completely custom JSX transformation using esbuild.

Your custom vdom engine (`src/main.tsx`) handles all rendering with:
- Custom `createElement` function
- Fiber-based reconciliation
- Custom `useState` hook implementation

## Build Pipeline

```
.tsx files with JSX
        ↓
   esbuild transforms 
   <div> → engine.createElement("div", ...)
        ↓
   .js files (ES modules)
        ↓
   Browser executes with your custom engine
```

## Why esbuild Instead of TypeScript

TypeScript's JSX modes have React-centric naming (`"jsx": "react"`). Even though you can override with `jsxFactory`, the semantics feel wrong.

**esbuild** gives you:
- Custom JSX factory with no React naming
- Faster builds (10-100x faster than tsc)
- Native ES module output
- Watch mode built-in
- Zero config needed

## Files

- `esbuild.watch.js` - Dev mode (watch for changes)
- `esbuild.build.js` - Production build
- `tsconfig.json` - Type checking only (`noEmit: true`)
- `server.js` - Dev server + runs esbuild watch

## Commands

```bash
# Development (auto-rebuilds on change)
npm run dev

# Production build
npm run build

# Type check
npx tsc --noEmit
```

## How JSX Works

Your `.tsx` files use JSX syntax:

```tsx
function MyComponent() {
  return <div className="example">Hello</div>
}
```

esbuild transforms it to:

```javascript
function MyComponent() {
  return engine.createElement("div", { className: "example" }, "Hello")
}
```

Then your custom `engine.createElement` in `main.tsx` handles the rest.

## No React Anywhere

- ❌ No `react` package
- ❌ No `react-dom` package
- ❌ No React semantics in build config
- ✅ Pure custom vdom implementation
- ✅ Full control over rendering
- ✅ Zero framework bloat

## Performance

esbuild is **extremely fast**:
- ~10ms builds for small projects
- Watch mode has minimal overhead
- Native Go performance

TypeScript is still used for type checking (in parallel), but doesn't slow down the build.
