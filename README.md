# stack

Custom fiber-reconciler vdom engine, message-based API transport with visitor dispatch, runtime feature flags. No React. No framework.

## Run

```bash
cd frontend && npm install && npm run dev   # :8080
cd backend  && npm install && npm run dev   # :3000
```

Set `dev.enabled: true` in `config/flags.json` to skip the backend and run against local mocks.

---

## How it fits together

Every user action becomes a **message** — a `{ command, payload }` object dispatched through `sendMessage`. In dev mode a visitor object handles it locally. In production it POSTs to `/msg` and the backend `handlers` map takes over.

```
UI event → message creator → sendMessage
  → dev:  devVisitor[command](message)
  → prod: POST /msg → handlers[command](content, userId)
```

State lives in `AppState`. `updateState({...})` patches it and re-renders. That's the whole loop.

---

## Adding a feature

**1. Define the command**

`frontend/src/types/messages.js`
```js
const CommandRegistry = {
  save_note: 0,
};

export function saveNoteMessage(text) {
  return message('save_note', { text });
}
```

**2. Wire the dev mock**

`frontend/src/lib/api.js` — add to `devVisitor`:
```js
const devVisitor = {
  save_note: (msg) => ({ id: 'mock-1', text: msg.payload.content.text }),
};
```

**3. Add the backend handler**

`backend/server.js` — add to `handlers`:
```js
const handlers = {
  save_note: async (content, userId) => {
    // persist to DB...
    return { id: newId, text: content.text };
  },
};
```

**4. Call it from a component**

```js
import { sendMessage } from '../lib/api.js';
import { saveNoteMessage } from '../types/messages.js';

async function save(text) {
  const result = await sendMessage(saveNoteMessage(text));
  updateState({ notes: [...AppState.notes, result] });
}
```

---

## State

`AppState` is a plain object. Add fields as needed, then call `updateState` to patch and re-render.

```js
// lib/state.js
export let AppState = {
  currentView: 'home',
  notes: [],
  loading: false,
};
```

```js
updateState({ loading: true });
updateState({ notes: data, loading: false });
```

---

## Components

Functions that return `createElement` trees. The engine diffs and patches the real DOM — only nodes that actually changed get touched.

```js
import { createElement } from '../engine/main.js';
import { AppState, updateState } from '../lib/state.js';

export function NoteList() {
  return createElement('div', { className: 'note-list' },
    ...AppState.notes.map(note =>
      createElement('p', null, note.text)
    )
  );
}
```

The reactive loop: `updateState` patches `AppState` → every subscriber fires → your component function re-runs → the engine walks the old and new trees simultaneously → only changed nodes get DOM operations. Nothing special required — that's just how it works.

For **local** state that doesn't need to live globally, the engine has `useState`:

```js
import { useState } from '../engine/main.js';

export function Counter() {
  const [count, setCount] = useState(0);
  return createElement('button', {
    onClick: () => setCount(c => c + 1),
  }, `Count: ${count}`);
}
```

---

## Mounting and ref

Normally you never touch the DOM directly — you describe what should exist and the engine handles it. A `ref` is the escape hatch for when you actually need the real DOM node: calling `.play()` on a video, measuring dimensions, handing an element to a third-party library, setting focus. Things that can't be expressed as a description.

Pass a callback as `ref` and the engine calls it with the real DOM node after inserting it:

```js
const onMount = (el) => {
  el.style.opacity = '1';  // el is the actual DOM node
};

createElement('div', { ref: onMount })
```

The timing issue: the engine inserts the element and immediately fires `ref` — but children are inserted in the next step. So at the moment `ref` fires, `querySelector` on children returns null. `requestAnimationFrame` defers until the call stack is clear, which is after children land:

`requestAnimationFrame` defers until after the current JS call stack finishes, which is after all children are committed:

```js
const onMount = (el) => {
  if (!el) return;
  requestAnimationFrame(() => {
    // children are in the DOM here — querySelector works
    el.querySelector('input')?.focus();
  });
};

createElement('div', { ref: onMount },
  createElement('input', { type: 'text' })
)
```

Rule of thumb: no children to query → no `requestAnimationFrame` needed. Querying children → always wrap.

---

## Engine surface

```js
createElement(type, props, ...children)  // build a vnode
render(element, container)               // mount or reconcile into container
useState(initial)                        // local component state, triggers re-render on set
```

---

## Backend

`backend/server.js` exports a Lambda handler via `serverless-http` and runs locally with `node --watch`. Every command routes through the `handlers` map — add a key, ship a feature.
