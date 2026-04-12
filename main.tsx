declare namespace JSX {
  interface IntrinsicElements { [tag: string]: any }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ─── Shared render state ──────────────────────────────────────────────────────
let nextUnitOfWork = null  // next fiber the work loop will process
let currentRoot    = null  // committed tree — what's on screen right now
let wipRoot        = null  // fiber tree currently being built
let deletions      = null  // fibers scheduled for removal on next commit
let wipFiber       = null  // function component fiber currently being rendered
let hookIndex      = null  // which hook call we're on within the current render
let loopScheduled  = false // guards against double-scheduling the work loop

// ─── Microtask scheduler ─────────────────────────────────────────────────────
// rIC / requestIdleCallback time-slices the render across many callbacks.
// When the browser fires each callback with timeRemaining()=0 (common under
// any mild load), every single fiber forces a re-arm, letting event handlers
// fire in-between and overwrite wipRoot mid-tree — producing stale commits.
// For a small UI builder we never need to yield; run the whole tree in one
// microtask that fires after all synchronous setState calls in the same event
// handler are batched together, but before the browser paints.
const rIC: (cb: () => void) => void = cb =>
  (typeof queueMicrotask !== "undefined" ? queueMicrotask : (f: () => void) => Promise.resolve().then(f))(cb)

// ─── Notification system ──────────────────────────────────────────────────────
// OpenMCT-inspired: the engine never assumes a display surface. Every internal
// warning routes through _notify() so consumers can wire custom logging, toast
// UI, or telemetry without patching engine internals.
// Three levels: "info" (diagnostic), "alert" (recoverable), "error" (failure).

type Severity = "info" | "alert" | "error"
const _handlers: ((msg: string, sev: Severity) => void)[] = []

function addNotificationHandler(fn: (msg: string, sev: Severity) => void) {
  _handlers.push(fn)
}

function _notify(msg: string, sev: Severity = "info") {
  if (!_handlers.length) {
    ;({ info: console.log, alert: console.warn, error: console.error })[sev](
      `[engine:${sev}] ${msg}`
    )
    return
  }
  _handlers.forEach(h => h(msg, sev))
}

// ─── Policy system ────────────────────────────────────────────────────────────
// OpenMCT consensus model: any policy returning false blocks element creation.
// Policies default to allowing; only explicit false rejects.

const _policies: ((type: any, props: any) => boolean)[] = []
function addPolicy(fn: (type: any, props: any) => boolean) { _policies.push(fn) }
function _passesPolicy(type: any, props: any): boolean {
  return _policies.every(p => p(type, props) !== false)
}

// ─── Tooling ──────────────────────────────────────────────────────────────────

function processText(text: string | number) {
  if (typeof text !== "string" && typeof text !== "number")
    _notify(`text_element expects string or number, got: ${typeof text}`, "alert")
  // Raised from 10 → 100 so normal UI strings don't flood the console
  if (String(text).length > 100)
    _notify(`Very long text node (${String(text).length} chars)`, "info")
}

// ─── Virtual DOM ─────────────────────────────────────────────────────────────

function createTextElement(text: string | number) {
  processText(text)
  return { type: "TEXT_ELEMENT", props: { nodeValue: text, children: [] } }
}

// Filters null/false children so conditional renders ({flag && <El/>})
// never reach createTextElement with a non-string value.
function createElement(type: any, props: any, ...children: any[]) {
  const p = {
    ...props,
    children: children
      .map(c => (c == null || c === false) ? null : typeof c === "object" ? c : createTextElement(c))
      .filter(Boolean),
  }
  if (!_passesPolicy(type, p)) { _notify(`createElement blocked: "${type}"`, "error"); return null }
  return { type, props: p }
}

// ─── DOM creation ────────────────────────────────────────────────────────────

function createDom(fiber: any) {
  const dom = fiber.type === "TEXT_ELEMENT"
    ? document.createTextNode("")
    : document.createElement(fiber.type)
  updateDom(dom, {}, fiber.props)
  return dom
}

// ─── Prop helpers ─────────────────────────────────────────────────────────────

const isEvent    = (k: string) => k.startsWith("on")
// passive: true on scroll/touch events prevents scroll-blocking listeners
// (significant mobile performance win — avoids forced synchronous layout)
const isPassive  = (k: string) =>
  k === "touchstart" || k === "touchmove" || k === "wheel" || k === "scroll"
// aria-*, data-*, role, and style all require setAttribute — property assignment
// is silently ignored for these in most browsers. OpenMCT accessibility pattern.
const isAria     = (k: string) =>
  k.startsWith("aria-") || k.startsWith("data-") || k === "role" || k === "style"
const isProperty = (k: string) =>
  k !== "children" && k !== "key" && !isEvent(k) && !isAria(k)
const isNew      = (p: any, n: any) => (k: string) => p[k] !== n[k]
const isGone     = (p: any, n: any) => (k: string) => !(k in n)

// Six-pass DOM sync. Order matters: remove before add, ARIA separate from props.
function updateDom(dom: any, prev: any, next: any) {
  // 1. Remove stale/changed event listeners (with correct passive flag)
  Object.keys(prev).filter(isEvent)
    .filter(k => !(k in next) || isNew(prev, next)(k))
    .forEach(k => {
      const e = k.toLowerCase().slice(2)
      dom.removeEventListener(e, prev[k], isPassive(e) ? { passive: true } : false)
    })
  // 2. Blank removed plain props
  Object.keys(prev).filter(isProperty).filter(isGone(prev, next))
    .forEach(k => { dom[k] = "" })
  // 3. Remove gone ARIA / data / style attrs
  Object.keys(prev).filter(isAria).filter(isGone(prev, next))
    .forEach(k => dom.removeAttribute(k))
  // 4. Set new/changed plain props
  Object.keys(next).filter(isProperty).filter(isNew(prev, next))
    .forEach(k => { dom[k] = next[k] })
  // 5. Set new/changed ARIA / data / style via setAttribute
  Object.keys(next).filter(isAria).filter(isNew(prev, next))
    .forEach(k => dom.setAttribute(k, next[k]))
  // 6. Attach new/changed event listeners
  Object.keys(next).filter(isEvent).filter(isNew(prev, next))
    .forEach(k => {
      const e = k.toLowerCase().slice(2)
      dom.addEventListener(e, next[k], isPassive(e) ? { passive: true } : false)
    })
}

// ─── Commit phase ─────────────────────────────────────────────────────────────

// After all DOM mutations flush, run useEffect setups.
// Mirrors OpenMCT's mounted() / beforeUnmount() lifecycle guarantee.
function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
  commitEffects(currentRoot.child)
}

function commitWork(fiber: any) {
  if (!fiber) return
  let p = fiber.parent
  while (!p.dom) p = p.parent       // climb past function-component fibers
  const domParent = p.dom
  if      (fiber.effectTag === "PLACEMENT" && fiber.dom != null) domParent.appendChild(fiber.dom)
  else if (fiber.effectTag === "DELETION")  { runEffectCleanups(fiber); commitDeletion(fiber, domParent); return }
  else if (fiber.effectTag === "UPDATE" && fiber.dom != null)  updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber: any, domParent: any) {
  if (fiber.dom) domParent.removeChild(fiber.dom)
  else commitDeletion(fiber.child, domParent)
}

// Walk committed tree, flush pending useEffect setups (prior cleanup fires first).
function commitEffects(fiber: any) {
  if (!fiber) return
  if (fiber.hooks) {
    fiber.hooks.filter((h: any) => h._effect && h._pending).forEach((h: any) => {
      if (h.cleanup) h.cleanup()
      h.cleanup  = h.run() || null
      h._pending = false
    })
  }
  commitEffects(fiber.child)
  commitEffects(fiber.sibling)
}

// Run effect cleanups on a subtree being unmounted.
function runEffectCleanups(fiber: any) {
  if (!fiber) return
  if (fiber.hooks) {
    fiber.hooks.filter((h: any) => h._effect && h.cleanup).forEach((h: any) => {
      h.cleanup(); h.cleanup = null
    })
  }
  runEffectCleanups(fiber.child)
  runEffectCleanups(fiber.sibling)
}

// ─── Work loop — wake-on-demand ───────────────────────────────────────────────
// The loop is dormant when there is no work. setState and render call
// scheduleWork() to kick off a new cycle. This avoids continuous idle callbacks
// on mobile, which would drain battery even when the UI is static.

function scheduleWork() {
  if (loopScheduled) return
  loopScheduled = true
  rIC(workLoop)
}

function workLoop() {
  loopScheduled = false
  // No time-slicing: process the entire tree in one synchronous batch.
  // This prevents event handlers from overwriting wipRoot mid-tree.
  while (nextUnitOfWork) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }
  if (wipRoot) {
    try {
      commitRoot()
    } catch (err: any) {
      _notify("commit error: " + (err && err.message), "error")
      // Reset to a safe state so future renders can still proceed
      wipRoot = null
    }
  }
}

function performUnitOfWork(fiber: any) {
  if (fiber.type instanceof Function) updateFunctionComponent(fiber)
  else updateHostComponent(fiber)
  if (fiber.child) return fiber.child
  let next = fiber
  while (next) { if (next.sibling) return next.sibling; next = next.parent }
}

// ─── Component updaters ───────────────────────────────────────────────────────

// OpenMCT pattern: try/catch around component calls prevents one bad component
// from crashing the tree. Errors route through the notification system.
function updateFunctionComponent(fiber: any) {
  wipFiber = fiber; hookIndex = 0; wipFiber.hooks = []
  try {
    const raw = fiber.type(fiber.props)
    reconcileChildren(fiber, [].concat(raw).filter(Boolean))
  } catch (err: any) {
    _notify(`<${fiber.type.name || "?"}>: ${err && err.message}`, "error")
    reconcileChildren(fiber, [])
  }
}

// Flatten array children so .map() inside JSX works without Fragment wrappers.
function updateHostComponent(fiber: any) {
  if (!fiber.dom) fiber.dom = createDom(fiber)
  const children = ((fiber.props.children || []) as any[]).flat().filter(Boolean)
  reconcileChildren(fiber, children)
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useState(initial: any): [any, (action: any) => void] {
  const old = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
  const hook: any = { state: old ? old.state : initial, queue: [] }
  ;(old ? old.queue : []).forEach((a: any) => {
    hook.state = typeof a === "function" ? a(hook.state) : a
  })
  const setState = (action: any) => {
    hook.queue.push(action)
    wipRoot = { dom: currentRoot.dom, props: currentRoot.props, alternate: currentRoot, _context: currentRoot._context || {} }
    nextUnitOfWork = wipRoot
    deletions = []
    scheduleWork()
  }
  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

// useEffect: OpenMCT on()/off() lifecycle. run() fires post-commit (mounted).
// Its return value fires before next run or on unmount (beforeUnmount).
// deps: omit → every render | [] → once | [a,b] → when a or b changes.
function useEffect(run: () => (() => void) | void, deps?: any[]) {
  const old = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
  const changed = !old || deps === undefined || deps.some((d: any, i: number) => d !== ((old.deps || [])[i]))
  wipFiber.hooks.push({ _effect: true, run, deps, cleanup: old ? old.cleanup : null, _pending: changed })
  hookIndex++
}

// ─── Context system ────────────────────────────────────────────────────────────
// OpenMCT: independent contexts per view. Values ride on _context (plain object)
// on each fiber. Provider stamps wipFiber._context before reconcileChildren runs
// so all descendants inherit the value via the copy in reconcileChildren.

let _ctxSeq = 0
function createContext(defaultValue: any) {
  const id = "__ctx" + (_ctxSeq++)
  function Provider(props: any) {
    const { value, children } = props
    wipFiber._context = Object.assign({}, wipFiber._context || {}, { [id]: value })
    return children
  }
  return { _id: id, _default: defaultValue, Provider }
}
function useContext(ctx: { _id: string; _default: any }): any {
  const v = wipFiber._context && wipFiber._context[ctx._id]
  return v !== undefined ? v : ctx._default
}

// Fragment: return multiple children without a DOM wrapper.
function Fragment(props: any) { return props.children }

// ─── Token theming ────────────────────────────────────────────────────────────
// NASAWDS pattern: tokens are the authoritative source of design values.
// Components call useTheme() rather than hardcoding colors or spacing.
// ThemeProvider can override any subset for a subtree.

function createTheme(tokens: Record<string, any>) {
  const ctx = createContext(tokens)
  function ThemeProvider(props: any) {
    const { theme, children } = props
    return ctx.Provider({ value: Object.assign({}, tokens, theme), children })
  }
  function useTheme() { return useContext(ctx) }
  return { ThemeProvider, useTheme }
}

// ─── Reconciler ───────────────────────────────────────────────────────────────

// Key map for O(1) identity resolution — mirrors OpenMCT's (namespace, key) tuples.
function _buildKeyMap(f: any): Map<any, any> {
  const m = new Map()
  while (f) { if (f.props && f.props.key != null) m.set(f.props.key, f); f = f.sibling }
  return m
}

function reconcileChildren(wipFiberArg: any, elements: any[]) {
  elements = (elements as any[]).flat().filter(Boolean)  // flatten .map() arrays
  let index       = 0
  let oldFiber    = wipFiberArg.alternate ? wipFiberArg.alternate.child : null
  let prevSibling = null
  const parentCtx = wipFiberArg._context || {}
  const hasKeys   = elements.some((el: any) => el && el.props && el.props.key != null)
  const keyMap    = hasKeys ? _buildKeyMap(oldFiber) : null

  // Track which keyless old fibers were consumed as positional matches so the
  // walk-old-keyless cleanup below does NOT also mark them for DELETION.
  // Bug: without this, [p(no-key), btn(key=A), btn(key=B)] causes the reconciler
  // to UPDATE p in the main loop AND mark it DELETION in the cleanup — detaching
  // its DOM node.  On the next render the already-detached node is removeChild'd
  // again, which throws DOMException, the try/catch swallows it, wipRoot is cleared
  // but currentRoot is NOT updated, permanently freezing the app.
  const keylessConsumed: Set<any> = hasKeys ? new Set() : null as any

  // When keyed: only iterate new elements — old fibers are resolved via keyMap + cleanup below.
  // When unkeyed: iterate until both new elements and old fibers are exhausted.
  // BUG PREVENTED: the unguarded `|| oldFiber != null` caused an infinite loop in keyed
  // mode because oldFiber is never advanced when hasKeys=true.
  while (index < elements.length || (!hasKeys && oldFiber != null)) {
    const element = elements[index]
    let newFiber  = null
    const elementIsKeyless = hasKeys && element && (element.props == null || element.props.key == null)
    const matched = (hasKeys && element && element.props && element.props.key != null)
      ? keyMap.get(element.props.key) : oldFiber

    // Mark this keyless old fiber as consumed so the cleanup walk skips it.
    if (elementIsKeyless && oldFiber) keylessConsumed.add(oldFiber)

    const sameType = matched && element && element.type == matched.type

    if (sameType) {
      newFiber = { type: matched.type, props: element.props, dom: matched.dom, parent: wipFiberArg, alternate: matched, effectTag: "UPDATE", _context: Object.assign({}, parentCtx) }
      if (hasKeys) keyMap.delete(element.props.key)
    }
    if (element && !sameType) {
      newFiber = { type: element.type, props: element.props, dom: null, parent: wipFiberArg, alternate: null, effectTag: "PLACEMENT", _context: Object.assign({}, parentCtx) }
      if (hasKeys && matched) { matched.effectTag = "DELETION"; deletions.push(matched) }
    }
    if (!hasKeys && oldFiber && !sameType) { oldFiber.effectTag = "DELETION"; deletions.push(oldFiber) }
    if (!hasKeys) oldFiber = oldFiber ? oldFiber.sibling : null
    if (index === 0) wipFiberArg.child = newFiber; else if (element) prevSibling.sibling = newFiber
    prevSibling = newFiber; index++
  }

  if (hasKeys) {
    // Delete keyed old fibers that had no matching new element
    keyMap.forEach((f: any) => { f.effectTag = "DELETION"; deletions.push(f) })
    // Delete keyless old fibers that were NOT consumed as positional matches above.
    // (e.g. an old plain <p> that was replaced by a fully-keyed list).
    let f = wipFiberArg.alternate ? wipFiberArg.alternate.child : null
    while (f) {
      if (f.props && f.props.key == null && !keylessConsumed.has(f)) {
        f.effectTag = "DELETION"; deletions.push(f)
      }
      f = f.sibling
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function render(element: any, container: any) {
  wipRoot = { dom: container, props: { children: [element] }, alternate: currentRoot, _context: {} }
  deletions = []; nextUnitOfWork = wipRoot
  scheduleWork()
}

const engine = {
  createElement, render, useState, useEffect,
  createContext, useContext, Fragment, createTheme,
  addPolicy, addNotificationHandler,
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

engine.addNotificationHandler((msg, sev) =>
  ({ info: console.log, alert: console.warn, error: console.error })[sev](
    `[engine:${sev}] ${msg}`
  )
)

// NASA design tokens — NASAWDS palette (Helvetica, NASA blue / red).
// All component styles reference these tokens; no hardcoded values downstream.
const { ThemeProvider, useTheme } = engine.createTheme({
  colorPrimary:  "#0b3d91",   // NASA blue
  colorAccent:   "#fc3d21",   // NASA red
  colorSurface:  "#ffffff",
  colorBg:       "#f0f2f5",
  colorText:     "#1a1a2e",
  colorMuted:    "#666666",
  colorBorder:   "#e0e0e0",
  fontBase:      "Helvetica, Arial, sans-serif",
})

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

// Btn — accessible button with three variants.
// touch-action: manipulation (via CSS class) eliminates 300ms tap delay on mobile.
function Btn(props: any) {
  const { label, variant = "primary", onClick, disabled = false } = props
  return (
    <button
      className={"btn btn--" + variant}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled ? "true" : "false"}
    >
      {label}
    </button>
  )
}

// Field — labeled, accessible text input.
// id + htmlFor links label to input for screen readers and tap-target expansion.
function Field(props: any) {
  const { id, label, value, onInput, placeholder = "" } = props
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <input
        id={id}
        className="field__input"
        value={value}
        onInput={onInput}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// UI BUILDER
// ═══════════════════════════════════════════════════════════════════════════

const PALETTE: { type: string; label: string; icon: string }[] = [
  { type: "Heading",   label: "Heading",   icon: "H" },
  { type: "Paragraph", label: "Paragraph", icon: "P" },
  { type: "Button",    label: "Button",    icon: "B" },
  { type: "Input",     label: "Input",     icon: "I" },
  { type: "Badge",     label: "Badge",     icon: "*" },
  { type: "Divider",   label: "Divider",   icon: "─" },
  { type: "Div",       label: "Container", icon: "⬚" },
]

function defaultPropsFor(type: string): Record<string, any> {
  const map: Record<string, any> = {
    Heading:   { level: 2, content: "Heading" },
    Paragraph: { content: "Paragraph text." },
    Button:    { label: "Button", variant: "primary" },
    Input:     { label: "Label", placeholder: "Enter text" },
    Badge:     { content: "Status", variant: "info" },
    Divider:   {},
    Div:       { label: "Container" },
  }
  return map[type] || {}
}

// renderPreview: produces a non-interactive DOM preview of each component type.
// Uses engine.createElement directly (not JSX) so tag names can be dynamic.
function renderPreview(item: any) {
  const p = item.props
  switch (item.type) {
    case "Heading":
      return engine.createElement(
        "h" + (p.level || 2),
        { className: "preview-heading preview-heading--" + (p.level || 2) },
        p.content || "Heading"
      )
    case "Paragraph":
      return engine.createElement("p", { className: "preview-text" }, p.content || "Paragraph")
    case "Button":
      return engine.createElement(
        "button",
        { className: "preview-btn preview-btn--" + (p.variant || "primary"), type: "button", tabIndex: -1 },
        p.label || "Button"
      )
    case "Input":
      return engine.createElement(
        "div", { className: "preview-input-wrap" },
        engine.createElement("label", { className: "preview-input-label" }, p.label || "Label"),
        engine.createElement("input", { className: "preview-input", placeholder: p.placeholder || "", type: "text", tabIndex: -1 })
      )
    case "Badge":
      return engine.createElement(
        "span",
        { className: "preview-badge preview-badge--" + (p.variant || "info") },
        p.content || "Badge"
      )
    case "Divider":
      return engine.createElement("hr", { className: "preview-divider" })
    case "Div":
      return engine.createElement("div", { className: "preview-container" },
        engine.createElement("span", { className: "preview-container__label" }, p.label || "Container")
      )
    default:
      return engine.createElement("div", {}, "?")
  }
}

// PropsEditor — renders editable property fields for the selected canvas item.
// Gracefully shows an empty state when nothing is selected (aria-live keeps
// screen readers informed of the change without stealing focus).
function PropsEditor(props: any) {
  const { item, onUpdate } = props

  if (!item) {
    return (
      <p className="props-empty" aria-live="polite">
        Select a canvas element to edit its properties.
      </p>
    )
  }

  const p   = item.props
  const uid = "props-" + item.id

  // Per-type property forms. Each field fires onUpdate immediately on input
  // so the canvas preview updates in real time.
  switch (item.type) {
    case "Heading":
      return (
        <div className="props-form">
          <Field
            id={uid + "-content"}
            label="Content"
            value={p.content || ""}
            onInput={(e: any) => onUpdate(item.id, { content: e.target.value })}
          />
          <div className="field">
            <label htmlFor={uid + "-level"} className="field__label">Level</label>
            <select
              id={uid + "-level"}
              className="field__select"
              onChange={(e: any) => onUpdate(item.id, { level: parseInt(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map(n =>
                engine.createElement("option", { key: n, value: String(n), selected: n === (p.level || 2) }, "H" + n)
              )}
            </select>
          </div>
        </div>
      )

    case "Paragraph":
      return (
        <div className="props-form">
          <Field
            id={uid + "-content"}
            label="Content"
            value={p.content || ""}
            onInput={(e: any) => onUpdate(item.id, { content: e.target.value })}
          />
        </div>
      )

    case "Button":
      return (
        <div className="props-form">
          <Field
            id={uid + "-label"}
            label="Label"
            value={p.label || ""}
            onInput={(e: any) => onUpdate(item.id, { label: e.target.value })}
          />
          <div className="field">
            <label htmlFor={uid + "-variant"} className="field__label">Variant</label>
            <select
              id={uid + "-variant"}
              className="field__select"
              onChange={(e: any) => onUpdate(item.id, { variant: e.target.value })}
            >
              {["primary", "secondary", "ghost"].map(v =>
                engine.createElement("option", { key: v, value: v, selected: v === (p.variant || "primary") }, v[0].toUpperCase() + v.slice(1))
              )}
            </select>
          </div>
        </div>
      )

    case "Input":
      return (
        <div className="props-form">
          <Field
            id={uid + "-label"}
            label="Label"
            value={p.label || ""}
            onInput={(e: any) => onUpdate(item.id, { label: e.target.value })}
          />
          <Field
            id={uid + "-placeholder"}
            label="Placeholder"
            value={p.placeholder || ""}
            onInput={(e: any) => onUpdate(item.id, { placeholder: e.target.value })}
          />
        </div>
      )

    case "Badge":
      return (
        <div className="props-form">
          <Field
            id={uid + "-content"}
            label="Text"
            value={p.content || ""}
            onInput={(e: any) => onUpdate(item.id, { content: e.target.value })}
          />
          <div className="field">
            <label htmlFor={uid + "-variant"} className="field__label">Variant</label>
            <select
              id={uid + "-variant"}
              className="field__select"
              onChange={(e: any) => onUpdate(item.id, { variant: e.target.value })}
            >
              {["info", "success", "warning", "error"].map(v =>
                engine.createElement("option", { key: v, value: v, selected: v === (p.variant || "info") }, v[0].toUpperCase() + v.slice(1))
              )}
            </select>
          </div>
        </div>
      )

    case "Div":
      return (
        <div className="props-form">
          <Field
            id={uid + "-label"}
            label="Label"
            value={p.label || ""}
            onInput={(e: any) => onUpdate(item.id, { label: e.target.value })}
          />
        </div>
      )

    default:
      return <p className="props-empty">No editable properties.</p>
  }
}

// BuilderApp — root component. Holds all builder state; passes callbacks down.
// Three panels: palette (add), canvas (arrange/select), props (edit).
// Mobile: one panel visible at a time controlled by activeTab.
// Desktop: all three visible side-by-side via CSS media query.
function BuilderApp() {
  const [items,      setItems]      = engine.useState([])
  const [selectedId, setSelectedId] = engine.useState(null)
  const [activeTab,  setActiveTab]  = engine.useState("palette")

  // Update document title on item count change (useEffect / OpenMCT on() pattern)
  engine.useEffect(() => {
    const n = (items as any[]).length
    document.title = n > 0 ? "Scratch UI Builder (" + n + ")" : "Scratch UI Builder"
  }, [items])

  const addItem = (type: string) => {
    const id = "item-" + Date.now()
    // If a Container (Div) is currently selected, nest the new item inside it
    const parentId = (selectedItem && selectedItem.type === "Div") ? selectedItem.id : null
    setItems((prev: any[]) => [...prev, { id, type, props: defaultPropsFor(type), parentId }])
    setSelectedId(id)
    setActiveTab("canvas")
  }

  const updateItem = (id: string, delta: Record<string, any>) => {
    setItems((prev: any[]) =>
      prev.map((item: any) =>
        item.id === id ? { ...item, props: { ...item.props, ...delta } } : item
      )
    )
  }

  // Cascade-delete: removing a container also removes all its children
  const removeItem = (id: string) => {
    setItems((prev: any[]) => {
      const idsToRemove = new Set<string>([id])
      // Walk until no more children are found
      let changed = true
      while (changed) {
        changed = false
        prev.forEach((item: any) => {
          if (item.parentId && idsToRemove.has(item.parentId) && !idsToRemove.has(item.id)) {
            idsToRemove.add(item.id)
            changed = true
          }
        })
      }
      return prev.filter((item: any) => !idsToRemove.has(item.id))
    })
    setSelectedId((prev: any) => prev === id ? null : prev)
  }

  const selectedItem = (items as any[]).find((item: any) => item.id === selectedId) || null
  const count        = (items as any[]).length

  // Recursive canvas item renderer — produces vdom (not a component, no hooks)
  const makeCanvasItem = (item: any): any => {
    const nested = (items as any[]).filter((i: any) => i.parentId === item.id)
    const isSelected = item.id === selectedId
    const isContainer = item.type === "Div"

    return engine.createElement("div", {
      key:             item.id,
      className:       "canvas-item" + (isContainer ? " canvas-item--container" : ""),
      role:            "option",
      tabIndex:        0,
      "aria-selected": isSelected ? "true" : "false",
      onClick:         (e: any) => { e.stopPropagation(); setSelectedId(item.id); setActiveTab("props") },
      onKeyDown:       (e: any) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setSelectedId(item.id)
          setActiveTab("props")
        }
      },
    },
      // Header row: preview + type label + remove button
      engine.createElement("div", { className: "canvas-item__header" },
        engine.createElement("div", { className: "canvas-item__preview" }, renderPreview(item)),
        engine.createElement("span", { className: "canvas-item__type" },
          isContainer
            ? (isSelected ? "Container — click Add to nest inside" : "Container")
            : item.type
        ),
        engine.createElement("button", {
          className:   "canvas-item__remove",
          "aria-label": "Remove " + item.type,
          tabIndex:    0,
          onClick:     (e: any) => { e.stopPropagation(); removeItem(item.id) },
        }, "\u00D7")
      ),
      // Nested children slot — only rendered for Container type
      isContainer && engine.createElement("div", { className: "canvas-item__children" },
        nested.length === 0
          ? engine.createElement("p", { className: "canvas-item__drop-hint" },
              isSelected ? "Click a component in the palette to add it here." : "Empty container")
          : nested.map((child: any) => makeCanvasItem(child))
      )
    )
  }

  return (
    <ThemeProvider>
      <div className="app" role="application" aria-label="Scratch UI Builder">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="app-header" role="banner">
          <span className="app-logo" aria-hidden="true">&#9733;</span>
          <h1>Scratch UI Builder</h1>
          <span
            className="app-count"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {count + (count === 1 ? " element" : " elements")}
          </span>
        </header>

        {/* ── Mobile tab bar ─────────────────────────────────────────────── */}
        <nav className="tab-bar" role="tablist" aria-label="Builder panels">
          {[
            { id: "palette", label: "Add" },
            { id: "canvas",  label: "Canvas" },
            { id: "props",   label: "Edit" },
          ].map(tab =>
            engine.createElement("button", {
              key:             tab.id,
              className:       "tab-btn",
              role:            "tab",
              "aria-selected": activeTab === tab.id ? "true" : "false",
              "aria-controls": "panel-" + tab.id,
              onClick:         () => setActiveTab(tab.id),
            }, tab.label)
          )}
        </nav>

        {/* ── Main ───────────────────────────────────────────────────────── */}
        <main className="builder-main" role="main">

          {/* Palette panel */}
          <div
            id="panel-palette"
            className="panel panel--palette"
            role="tabpanel"
            aria-label="Component palette"
            data-active={activeTab === "palette" ? "true" : "false"}
          >
            <p className="panel-title">
              {selectedItem && selectedItem.type === "Div" ? "Add inside Container" : "Components"}
            </p>
            {PALETTE.map(pt =>
              engine.createElement("button", {
                key:         pt.type,
                className:   "palette-btn",
                onClick:     () => addItem(pt.type),
                "aria-label": "Add " + pt.label,
              },
                engine.createElement("span", { className: "palette-btn__icon", "aria-hidden": "true" }, pt.icon),
                " " + pt.label
              )
            )}
          </div>

          {/* Canvas panel */}
          <div
            id="panel-canvas"
            className="panel panel--canvas"
            role="tabpanel"
            aria-label="Canvas"
            data-active={activeTab === "canvas" ? "true" : "false"}
          >
            <p className="panel-title">
              {"Canvas" + (count > 0 ? " — " + count + (count === 1 ? " element" : " elements") : "")}
            </p>

            {count === 0
              ? engine.createElement(
                  "div", { className: "canvas-empty", "aria-live": "polite" },
                  engine.createElement("p", {}, "Add components from the left panel to get started.")
                )
              : engine.createElement(
                  "div", { className: "canvas-list", role: "listbox", "aria-label": "Canvas elements" },
                  (items as any[]).filter((i: any) => !i.parentId).map((item: any) => makeCanvasItem(item))
                )
            }
          </div>

          {/* Properties panel */}
          <div
            id="panel-props"
            className="panel panel--props"
            role="tabpanel"
            aria-label="Element properties"
            data-active={activeTab === "props" ? "true" : "false"}
          >
            <p className="panel-title">
              {selectedItem ? selectedItem.type + " Properties" : "Properties"}
            </p>
            <PropsEditor item={selectedItem} onUpdate={updateItem} />
            {selectedItem && (
              <Btn
                label="Remove element"
                variant="ghost-danger"
                onClick={() => { removeItem(selectedItem.id); setActiveTab("canvas") }}
              />
            )}
          </div>

        </main>
      </div>
    </ThemeProvider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════

function injectStyles(css: string) {
  const el = document.createElement("style")
  el.textContent = css
  document.head.appendChild(el)
}

injectStyles(`
/* ── Reset ────────────────────────────────────────────────────────────── */
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Helvetica, Arial, sans-serif;
  background: #f0f2f5;
  color: #1a1a2e;
  /* prevents font inflation on iOS when device rotates */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

/* ── App shell ────────────────────────────────────────────────────────── */
.app {
  display: flex;
  flex-direction: column;
  /* 100svh = small viewport height, avoids address-bar jump on mobile.
     Falls back to 100vh on browsers that don't support svh yet. */
  height: 100vh;
  height: 100svh;
  overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────────────── */
.app-header {
  background: #0b3d91;
  color: white;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  border-bottom: 3px solid #fc3d21;
}
.app-header h1 { font-size: 1rem; font-weight: 700; letter-spacing: 0.04em; flex: 1; }
.app-logo { font-size: 1rem; }
.app-count { font-size: 0.75rem; color: rgba(255,255,255,0.65); white-space: nowrap; }

/* ── Tab bar (mobile only) ────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  background: #0a2d6e;
  flex-shrink: 0;
}
/* touch-action:manipulation removes the 300ms tap delay on mobile browsers */
.tab-btn {
  flex: 1;
  padding: 0.625rem 0.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: rgba(255,255,255,0.55);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  touch-action: manipulation;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn[aria-selected="true"] { color: white; border-bottom-color: #fc3d21; }
.tab-btn:focus-visible { outline: 2px solid #fc3d21; outline-offset: -2px; }

/* ── Main layout ──────────────────────────────────────────────────────── */
.builder-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  flex-direction: column;
}

/* ── Panels ───────────────────────────────────────────────────────────── */
.panel {
  overflow-y: auto;
  padding: 1rem;
  background: white;
  display: none;             /* hidden by default on mobile */
  flex-direction: column;
  gap: 0.625rem;
}
.panel[data-active="true"] { display: flex; }
.panel--canvas { background: #f0f2f5; }
.panel-title {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #999;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

/* ── Desktop: three-column layout ────────────────────────────────────── */
@media (min-width: 768px) {
  .tab-bar      { display: none; }
  .builder-main { flex-direction: row; }
  .panel        { display: flex; }           /* all panels visible */
  .panel--palette { width: 200px; flex-shrink: 0; border-right: 1px solid #e0e0e0; }
  .panel--canvas  { flex: 1; }
  .panel--props   { width: 264px; flex-shrink: 0; border-left: 1px solid #e0e0e0; }
}

/* ── Palette buttons ──────────────────────────────────────────────────── */
.palette-btn {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1.5px solid #0b3d91;
  border-radius: 4px;
  color: #0b3d91;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  touch-action: manipulation;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.12s, color 0.12s;
}
.palette-btn:hover, .palette-btn:focus-visible {
  background: #0b3d91;
  color: white;
  outline: 2px solid #fc3d21;
  outline-offset: 2px;
}
.palette-btn__icon {
  width: 1.25rem;
  text-align: center;
  font-weight: 900;
  font-size: 0.8125rem;
  opacity: 0.7;
}

/* ── Canvas ───────────────────────────────────────────────────────────── */
.canvas-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 8rem;
}
.canvas-empty p {
  color: #bbb;
  font-size: 0.875rem;
  text-align: center;
  max-width: 180px;
  line-height: 1.6;
}
.canvas-list { display: flex; flex-direction: column; gap: 0.5rem; }

/* ── Canvas items ─────────────────────────────────────────────────────── */
.canvas-item {
  position: relative;
  padding: 0.75rem;
  background: white;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.12s;
}
.canvas-item:hover { border-color: #c8d0e8; }
.canvas-item[aria-selected="true"] {
  border-color: #0b3d91;
  box-shadow: 0 0 0 3px rgba(11,61,145,0.1);
}
.canvas-item:focus-visible { outline: 2px solid #fc3d21; outline-offset: 2px; }
.canvas-item__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}
.canvas-item__preview { flex: 1; min-width: 0; }
.canvas-item__type {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #bbb;
  white-space: nowrap;
}
.canvas-item--container { border-style: dashed; border-color: #c8d0e8; padding-bottom: 0.5rem; }
.canvas-item--container[aria-selected="true"] { border-color: #0b3d91; border-style: solid; }
.canvas-item__children {
  margin-top: 0.5rem;
  margin-left: 1rem;
  padding: 0.5rem;
  border-left: 2px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-height: 2.5rem;
}
.canvas-item__drop-hint {
  color: #bbb;
  font-size: 0.75rem;
  font-style: italic;
  padding: 0.25rem 0;
}
.canvas-item__remove {
  flex-shrink: 0;
  width: 22px; height: 22px;
  padding: 0;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 50%;
  color: #888;
  font-size: 1rem;
  line-height: 22px;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  touch-action: manipulation;
  transition: opacity 0.12s, background 0.12s, color 0.12s;
}
.canvas-item:hover > .canvas-item__header > .canvas-item__remove,
.canvas-item[aria-selected="true"] > .canvas-item__header > .canvas-item__remove { opacity: 1; }
.canvas-item__remove:hover { background: #fff0ee; border-color: #fc3d21; color: #fc3d21; }
.canvas-item__remove:focus-visible { outline: 2px solid #fc3d21; }

/* ── Preview components ───────────────────────────────────────────────── */
.preview-heading { font-weight: 700; color: #1a1a2e; margin: 0; }
.preview-heading--1 { font-size: 1.75rem; }
.preview-heading--2 { font-size: 1.375rem; }
.preview-heading--3 { font-size: 1.125rem; }
.preview-heading--4,.preview-heading--5,.preview-heading--6 { font-size: 1rem; }
.preview-text { color: #444; font-size: 0.9375rem; line-height: 1.6; margin: 0; }
.preview-btn {
  padding: 0.45rem 1rem;
  border-radius: 4px;
  border: 2px solid transparent;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: default;
  pointer-events: none;
}
.preview-btn--primary   { background: #0b3d91; color: white; }
.preview-btn--secondary { background: white; color: #0b3d91; border-color: #0b3d91; }
.preview-btn--ghost     { background: transparent; color: #0b3d91; border: none; text-decoration: underline; padding-left: 0; }
.preview-input-wrap  { display: flex; flex-direction: column; gap: 4px; }
.preview-input-label { font-size: 0.8125rem; font-weight: 600; color: #555; }
.preview-input       { padding: 0.4rem 0.625rem; border: 1.5px solid #ccc; border-radius: 4px; font-size: 0.875rem; color: #aaa; background: #fafafa; pointer-events: none; }
.preview-badge        { display: inline-block; padding: 0.2em 0.65em; border-radius: 100px; font-size: 0.75rem; font-weight: 700; }
.preview-badge--info    { background: #e8f0fe; color: #0b3d91; }
.preview-badge--success { background: #e6f4ea; color: #1e7e34; }
.preview-badge--warning { background: #fff8e1; color: #795b00; }
.preview-badge--error   { background: #fde8e8; color: #b71c1c; }
.preview-divider { border: none; border-top: 1.5px solid #e0e0e0; margin: 4px 0; }
.preview-container {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1.5px dashed #aaa;
  border-radius: 4px;
  background: #fafafa;
}
.preview-container__label { font-size: 0.8125rem; color: #888; font-style: italic; }

/* ── Form fields ──────────────────────────────────────────────────────── */
.field { display: flex; flex-direction: column; gap: 4px; }
.field__label { font-size: 0.75rem; font-weight: 700; color: #555; }
.field__input, .field__select {
  padding: 0.4rem 0.5rem;
  border: 1.5px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 100%;
  background: white;
  /* Minimum 16px font on iOS prevents auto-zoom on input focus */
  font-size: max(0.875rem, 16px);
}
.field__input:focus, .field__select:focus {
  outline: 2px solid #0b3d91;
  outline-offset: 1px;
  border-color: #0b3d91;
}

/* ── Properties form ──────────────────────────────────────────────────── */
.props-form { display: flex; flex-direction: column; gap: 0.625rem; }
.props-empty { color: #aaa; font-size: 0.875rem; line-height: 1.6; }

/* ── Buttons ──────────────────────────────────────────────────────────── */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  border: 2px solid transparent;
}
.btn--primary    { background: #0b3d91; color: white; border-color: #0b3d91; }
.btn--primary:hover { background: #083074; }
.btn--secondary  { background: white; color: #0b3d91; border-color: #0b3d91; }
.btn--ghost-danger {
  background: none; border: none;
  color: #b71c1c;
  font-size: 0.8125rem;
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
  touch-action: manipulation;
}
.btn--ghost-danger:hover { color: #7f0000; }
.btn:focus-visible { outline: 2px solid #fc3d21; outline-offset: 2px; }

/* ── Scrollbar styling ────────────────────────────────────────────────── */
.panel::-webkit-scrollbar       { width: 5px; }
.panel::-webkit-scrollbar-track { background: transparent; }
.panel::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

/* ── Global focus ring ────────────────────────────────────────────────── */
:focus-visible { outline: 2px solid #fc3d21; outline-offset: 2px; }
button:focus:not(:focus-visible) { outline: none; }
`)

engine.render(<BuilderApp />, document.getElementById("root"))
