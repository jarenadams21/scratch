# Harbinger Component Architecture

## Overview

Harbinger uses a clean component-based architecture with a custom vdom rendering engine. No React - 100% custom implementation.

## Directory Structure

```
frontend/src/
├── app.js               # Application entry point
├── engine/              # Custom vdom engine (createElement, render, useState)
│   ├── main.tsx         # TypeScript source
│   └── main.js          # Compiled JavaScript output
├── components/          # UI components
│   ├── App.js           # Main application container
│   ├── LoginForm.js     # Authentication UI
│   ├── EditorView.js    # Compose new entries
│   └── ArchiveView.js   # Archive list + reading pane
├── lib/                 # Utilities and libraries
│   ├── api.js           # Backend API client (message-based)
│   └── state.js         # Application state management
├── config/              # Configuration
│   └── flags-runtime.js # Runtime config (auto-generated)
├── data/                # Mock data
│   └── mock-data.js     # DEV mode fixtures
├── types/               # Type definitions
│   └── journal-messages.js  # Message creators
└── styles/              # Styling
    └── journal.css      # 1960s typewriter aesthetic
```

## Component Responsibilities

### `lib/state.js` - State Management
- Centralized application state
- State subscription system for re-renders
- Single source of truth for:
  - User authentication status
  - Loaded entries
  - Current view (compose/archive)
  - Loading/error states
  - Selected entry (for reading pane)

### `components/App.js` - Main Application
- Authentication routing
- View switching (compose ↔ archive)
- Data loading orchestration
- Navigation UI (header, tabs)

### `components/LoginForm.js` - Authentication
- Login/signup forms
- DEV mode indicator
- Form submission handling

### `components/EditorView.js` - Compose View
- New entry creation form
- Title and content inputs
- Form validation
- Publish functionality

### `components/ArchiveView.js` - Archive List & Reading Pane
- Outlook-style split view layout
- Left pane: Entry list with preview
- Right pane: Full reading view of selected entry
- Click entry to expand in reading pane
- Entry deletion from reading pane
- Close button for reading pane
- Empty state handling
- Sub-components:
  - `ArchiveListItem` - Compact entry in list
  - `ReadingPane` - Expanded entry view

### `engine/main.tsx` - Custom vdom Engine
- Virtual DOM implementation
- Fiber-based reconciliation
- createElement function
- render function
- useState hook
- Ref callback support
- Key-based reconciliation

### `lib/api.js` - API Client
- Message-based communication
- Backend API calls
- DEV mode mock data branching
- Authentication helpers
- CRUD operations (posts)

### `types/journal-messages.js` - Message Creators
- Type-safe message builders
- REGISTERED_NUM_MAP validation
- Message structure definitions

## State Flow

```
User Action
    ↓
Update State (updateState)
    ↓
State Subscribers Notified
    ↓
renderApp() Called
    ↓
App Component Re-renders
    ↓
New Virtual DOM
    ↓
Custom Engine Reconciliation
    ↓
Real DOM Updated
```

## View Switching Logic

When user clicks COMPOSE or ARCHIVE:

1. `switchView('compose')` or `switchView('archive')` called
2. `updateState({ currentView: 'compose' })` updates state
3. State subscribers trigger re-render
4. App component checks `AppState.currentView`
5. Renders appropriate component (EditorView or ArchiveView)
6. Form refs are freshly assigned on mount
7. Previous view's DOM is cleaned up by reconciler
8. If switching away from archive, `selectedEntry` is cleared

## Archive Split-View Interaction

The archive uses an Outlook-style split layout:

### Layout
```
┌──────────────────────────────────────────────────┐
│ HARBINGER                    [COMPOSE][ARCHIVE] │
├────────────────┬─────────────────────────────────┤
│ Entry List     │ Reading Pane                    │
│ (350px)        │ (flex: 1)                       │
│                │                                  │
│ • Entry 1      │ Selected Entry Title            │
│ • Entry 2 ◄────┼─ Full content displayed here    │
│ • Entry 3      │                                  │
│                │ [DELETE] button                  │
└────────────────┴─────────────────────────────────┘
```

### Interaction Flow

1. User clicks entry in left list
2. `updateState({ selectedEntry: entry })` called
3. Reading pane re-renders with selected entry
4. Clicked item highlighted in list
5. User can read full content or delete from reading pane

### State Management

- `AppState.selectedEntry` tracks currently viewed entry
- Clicking an entry updates this state
- Reading pane displays `selectedEntry` or empty state
- Deleting clears selection: `updateState({ selectedEntry: null })`
- Switching views clears selection

## Key Design Decisions

### Why Separate State File?
- Clear separation of concerns
- Easy to test state logic independently
- Prevents circular dependencies
- Centralized state updates

### Why Component Files?
- Single responsibility principle
- Easier to maintain and debug
- Reusable components
- Clear import/export boundaries

### Why Ref Callbacks?
- Direct DOM access when needed (forms)
- No useState overhead for simple inputs
- Refs set/updated by custom engine after mount
- Cleaned up automatically on unmount

### Why updateState Pattern?
- Predictable state updates
- Easy to track what changed
- Triggers re-render automatically
- Better than direct mutation

## Debugging

### View Not Updating?
Check browser console for:
- State update logs
- Component render logs
- Ref assignment confirmations

### Form Inputs Blank?
- Ensure refs are being called: Add `console.log` in ref callback
- Check if component is being unmounted/remounted unexpectedly
- Verify state updates are triggering re-renders

### State Not Persisting?
- Check if `updateState()` is being called (not direct mutation)
- Verify state subscribers are registered
- Look for accidental state resets

## Performance

### Re-render Optimization
- State updates batch automatically (render loop)
- Only changed components re-render (fiber reconciliation)
- Virtual DOM diff minimizes real DOM changes

### Memory Management
- State is singleton (no duplication)
- Components are functions (no class overhead)
- Refs cleaned up on unmount automatically

## Adding New Components

1. Create new file in `components/`
2. Import engine functions: `import { createElement } from '../main.js'`
3. Export component function: `export function MyComponent({ props }) { ... }`
4. Use in parent: `import { MyComponent } from './components/MyComponent.js'`

Example:
```javascript
import { createElement } from '../main.js';

export function MyComponent({ title, onClick }) {
  return createElement('div', { className: 'my-component' },
    createElement('h2', null, title),
    createElement('button', { onClick }, 'Click Me')
  );
}
```

## Testing

Test components in isolation:
```javascript
import { render } from './main.js';
import { MyComponent } from './components/MyComponent.js';

// Render to test container
const container = document.createElement('div');
render(MyComponent({ title: 'Test' }), container);

// Assert DOM structure
assert(container.querySelector('h2').textContent === 'Test');
```

## Future Enhancements

- [ ] Component lifecycle hooks
- [ ] Context API for deep prop passing
- [ ] Memoization for expensive renders
- [ ] DevTools for state inspection
- [ ] Hot module replacement
