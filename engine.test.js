"use strict"
// engine.test.js — State-machine unit tests for the custom virtual DOM engine.
// Run with:  node engine.test.js

// ─── Minimal DOM mock ──────────────────────────────────────────────────────────
// Enough surface area for createDom / updateDom / commitWork to work correctly.
class MockNode {
  constructor() {
    this._children = []
    this._parent   = null
    this._events   = {}
    this._attrs    = {}
  }
  appendChild(child) {
    if (child._parent) child._parent.removeChild(child)
    this._children.push(child)
    child._parent = this
    return child
  }
  removeChild(child) {
    const i = this._children.indexOf(child)
    if (i !== -1) { this._children.splice(i, 1); child._parent = null }
    return child
  }
  addEventListener(evt, handler)    { ;(this._events[evt] = this._events[evt] || []).push(handler) }
  removeEventListener(evt, handler) { if (this._events[evt]) this._events[evt] = this._events[evt].filter(h => h !== handler) }
  setAttribute(k, v)  { this._attrs[k] = String(v) }
  removeAttribute(k)  { delete this._attrs[k] }
}
class MockElement extends MockNode {
  constructor(tag) { super(); this.tagName = tag.toUpperCase() }
}
class MockTextNode extends MockNode {
  constructor(t) { super(); this.nodeValue = t }
}
global.document = {
  createElement:  tag  => new MockElement(tag),
  createTextNode: text => new MockTextNode(text),
}

// ─── Engine — verbatim copy of main.js engine section (lines 0-382) ───────────
// Variables are module-scope so resetEngine() can zero them between tests.

let nextUnitOfWork = null
let currentRoot    = null
let wipRoot        = null
let deletions      = null
let wipFiber       = null
let hookIndex      = null
let loopScheduled  = false

const rIC = cb =>
  (typeof queueMicrotask !== "undefined"
    ? queueMicrotask
    : f => Promise.resolve().then(f))(cb)

const _handlers = []
function addNotificationHandler(fn) { _handlers.push(fn) }
function _notify(msg, sev = "info") {
  if (!_handlers.length) {
    ;({ info: console.log, alert: console.warn, error: console.error })[sev](`[engine:${sev}] ${msg}`)
    return
  }
  _handlers.forEach(h => h(msg, sev))
}

const _policies = []
function addPolicy(fn) { _policies.push(fn) }
function _passesPolicy(type, props) { return _policies.every(p => p(type, props) !== false) }

function processText(text) {
  if (typeof text !== "string" && typeof text !== "number")
    _notify(`text_element expects string or number, got: ${typeof text}`, "alert")
}

function createTextElement(text) {
  processText(text)
  return { type: "TEXT_ELEMENT", props: { nodeValue: text, children: [] } }
}

function createElement(type, props, ...children) {
  const p = Object.assign({}, props, {
    children: children
      .map(c => (c == null || c === false) ? null : typeof c === "object" ? c : createTextElement(c))
      .filter(Boolean)
  })
  if (!_passesPolicy(type, p)) { _notify(`createElement blocked: "${type}"`, "error"); return null }
  return { type, props: p }
}

function createDom(fiber) {
  const dom = fiber.type === "TEXT_ELEMENT"
    ? document.createTextNode("")
    : document.createElement(fiber.type)
  updateDom(dom, {}, fiber.props)
  return dom
}

const isEvent    = k => k.startsWith("on")
const isPassive  = k => ["touchstart","touchmove","wheel","scroll"].includes(k)
const isAria     = k => k.startsWith("aria-") || k.startsWith("data-") || k === "role" || k === "style"
const isProperty = k => k !== "children" && k !== "key" && !isEvent(k) && !isAria(k)
const isNew      = (p, n) => k => p[k] !== n[k]
const isGone     = (p, n) => k => !(k in n)

function updateDom(dom, prev, next) {
  Object.keys(prev).filter(isEvent)
    .filter(k => !(k in next) || isNew(prev, next)(k))
    .forEach(k => { const e = k.toLowerCase().slice(2); dom.removeEventListener(e, prev[k]) })
  Object.keys(prev).filter(isProperty).filter(isGone(prev, next))
    .forEach(k => { dom[k] = "" })
  Object.keys(prev).filter(isAria).filter(isGone(prev, next))
    .forEach(k => dom.removeAttribute(k))
  Object.keys(next).filter(isProperty).filter(isNew(prev, next))
    .forEach(k => { dom[k] = next[k] })
  Object.keys(next).filter(isAria).filter(isNew(prev, next))
    .forEach(k => dom.setAttribute(k, next[k]))
  Object.keys(next).filter(isEvent).filter(isNew(prev, next))
    .forEach(k => { const e = k.toLowerCase().slice(2); dom.addEventListener(e, next[k]) })
}

function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
  commitEffects(currentRoot.child)
}

function commitWork(fiber) {
  if (!fiber) return
  let p = fiber.parent
  while (!p.dom) p = p.parent
  const domParent = p.dom
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null)
    domParent.appendChild(fiber.dom)
  else if (fiber.effectTag === "DELETION") {
    runEffectCleanups(fiber)
    commitDeletion(fiber, domParent)
    return
  }
  else if (fiber.effectTag === "UPDATE" && fiber.dom != null)
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) domParent.removeChild(fiber.dom)
  else commitDeletion(fiber.child, domParent)
}

function commitEffects(fiber) {
  if (!fiber) return
  if (fiber.hooks) {
    fiber.hooks.filter(h => h._effect && h._pending).forEach(h => {
      if (h.cleanup) h.cleanup()
      h.cleanup = h.run() || null
      h._pending = false
    })
  }
  commitEffects(fiber.child)
  commitEffects(fiber.sibling)
}

function runEffectCleanups(fiber) {
  if (!fiber) return
  if (fiber.hooks) {
    fiber.hooks.filter(h => h._effect && h.cleanup).forEach(h => { h.cleanup(); h.cleanup = null })
  }
  runEffectCleanups(fiber.child)
  runEffectCleanups(fiber.sibling)
}

function scheduleWork() {
  if (loopScheduled) return
  loopScheduled = true
  rIC(workLoop)
}

function workLoop() {
  loopScheduled = false
  while (nextUnitOfWork) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
  }
  if (wipRoot) {
    try { commitRoot() }
    catch (err) {
      _notify("commit error: " + (err && err.message), "error")
      wipRoot = null
    }
  }
}

function performUnitOfWork(fiber) {
  if (fiber.type instanceof Function) updateFunctionComponent(fiber)
  else updateHostComponent(fiber)
  if (fiber.child) return fiber.child
  let next = fiber
  while (next) {
    if (next.sibling) return next.sibling
    next = next.parent
  }
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  try {
    const raw = fiber.type(fiber.props)
    reconcileChildren(fiber, [].concat(raw).filter(Boolean))
  } catch (err) {
    _notify(`<${fiber.type.name || "?"}>: ${err && err.message}`, "error")
    reconcileChildren(fiber, [])
  }
}

function updateHostComponent(fiber) {
  if (!fiber.dom) fiber.dom = createDom(fiber)
  const children = (fiber.props.children || []).flat().filter(Boolean)
  reconcileChildren(fiber, children)
}

function useState(initial) {
  const old = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
  const hook = { state: old ? old.state : initial, queue: [] }
  ;(old ? old.queue : []).forEach(a => { hook.state = typeof a === "function" ? a(hook.state) : a })
  const setState = action => {
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

function useEffect(run, deps) {
  const old = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
  const changed = !old || deps === undefined || deps.some((d, i) => d !== ((old.deps || [])[i]))
  wipFiber.hooks.push({ _effect: true, run, deps, cleanup: old ? old.cleanup : null, _pending: changed })
  hookIndex++
}

let _ctxSeq = 0
function createContext(defaultValue) {
  const id = "__ctx" + (_ctxSeq++)
  function Provider(props) {
    const { value, children } = props
    wipFiber._context = Object.assign({}, wipFiber._context || {}, { [id]: value })
    return children
  }
  return { _id: id, _default: defaultValue, Provider }
}
function useContext(ctx) {
  const v = wipFiber._context && wipFiber._context[ctx._id]
  return v !== undefined ? v : ctx._default
}
function Fragment(props) { return props.children }

function _buildKeyMap(f) {
  const m = new Map()
  while (f) { if (f.props && f.props.key != null) m.set(f.props.key, f); f = f.sibling }
  return m
}

function reconcileChildren(wipFiberArg, elements) {
  elements = elements.flat().filter(Boolean)
  let index = 0
  let oldFiber = wipFiberArg.alternate ? wipFiberArg.alternate.child : null
  let prevSibling = null
  const parentCtx = wipFiberArg._context || {}
  const hasKeys = elements.some(el => el && el.props && el.props.key != null)
  const keyMap = hasKeys ? _buildKeyMap(oldFiber) : null

  // Track which keyless old fibers were consumed as positional matches so the
  // walk-old-keyless cleanup does NOT also mark them for DELETION.
  const keylessConsumed = hasKeys ? new Set() : null

  while (index < elements.length || (!hasKeys && oldFiber != null)) {
    const element = elements[index]
    let newFiber = null
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
    if (index === 0) wipFiberArg.child = newFiber
    else if (element) prevSibling.sibling = newFiber
    prevSibling = newFiber
    index++
  }

  if (hasKeys) {
    keyMap.forEach(f => { f.effectTag = "DELETION"; deletions.push(f) })
    // Delete keyless old fibers that were NOT consumed as positional matches.
    let f = wipFiberArg.alternate ? wipFiberArg.alternate.child : null
    while (f) {
      if (f.props && f.props.key == null && !keylessConsumed.has(f)) {
        f.effectTag = "DELETION"; deletions.push(f)
      }
      f = f.sibling
    }
  }
}

function render(element, container) {
  wipRoot = { dom: container, props: { children: [element] }, alternate: currentRoot, _context: {} }
  deletions = []
  nextUnitOfWork = wipRoot
  scheduleWork()
}

// ─── Test harness ─────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0, _failures = []

function resetEngine() {
  nextUnitOfWork = null
  currentRoot    = null
  wipRoot        = null
  deletions      = null
  wipFiber       = null
  hookIndex      = null
  loopScheduled  = false
}

// flush: drain all pending microtasks by yielding to a macrotask (setTimeout).
// queueMicrotask callbacks always fire before setTimeout(0), so by the time
// the promise resolves the entire work loop has committed.
function flush() { return new Promise(r => setTimeout(r, 0)) }

async function test(name, fn) {
  resetEngine()
  const root = new MockElement("div")
  // Set root.dom so commitWork can find the domParent anchor
  root.dom = root
  try {
    await fn(root)
    console.log(`  \x1b[32m✓\x1b[0m  ${name}`)
    _passed++
  } catch (err) {
    console.log(`  \x1b[31m✗\x1b[0m  ${name}`)
    console.log(`       \x1b[33m${err.message}\x1b[0m`)
    _failed++
    _failures.push({ name, err })
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed") }
function eq(a, b, msg)     { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }

// ─── Tests ────────────────────────────────────────────────────────────────────

;(async () => {
  console.log("\n\x1b[1mEngine state machine — unit tests\x1b[0m\n")

  // ── T1: vdom shape ──────────────────────────────────────────────────────────
  await test("T1  createElement produces correct vdom shape", async root => {
    const el = createElement("div", { id: "x" }, "hello")
    eq(el.type, "div")
    eq(el.props.id, "x")
    eq(el.props.children.length, 1)
    eq(el.props.children[0].type, "TEXT_ELEMENT")
    eq(el.props.children[0].props.nodeValue, "hello")
  })

  // ── T2: initial render commits DOM ──────────────────────────────────────────
  await test("T2  render appends DOM to container", async root => {
    render(createElement("h1", {}, "Hi"), root)
    await flush()
    eq(root._children.length, 1, "container must have 1 child")
    eq(root._children[0].tagName, "H1")
    eq(root._children[0]._children[0].nodeValue, "Hi")
  })

  // ── T3: useState initial value ───────────────────────────────────────────────
  await test("T3  useState returns initial value", async root => {
    let capturedValue
    function Comp() {
      const [v] = useState(42)
      capturedValue = v
      return createElement("span", {}, String(v))
    }
    render(createElement(Comp, {}), root)
    await flush()
    eq(capturedValue, 42, "captured value must be initial")
    eq(root._children[0]._children[0].nodeValue, "42", "DOM text must be '42'")
  })

  // ── T4: first setState updates DOM ──────────────────────────────────────────
  await test("T4  first setState re-renders and updates DOM", async root => {
    let setter
    function Counter() {
      const [n, setN] = useState(0)
      setter = setN
      return createElement("div", {}, String(n))
    }
    render(createElement(Counter, {}), root)
    await flush()
    eq(root._children[0]._children[0].nodeValue, "0", "initial render = '0'")

    setter(1)
    await flush()
    eq(root._children[0]._children[0].nodeValue, "1", "after setState(1) DOM must show '1'")
  })

  // ── T5: SECOND and THIRD setState must also re-render ───────────────────────
  // This is the critical regression: "works once then stops responding"
  await test("T5  second and third setState still update DOM", async root => {
    let setter
    function Counter() {
      const [n, setN] = useState(0)
      setter = setN
      return createElement("div", {}, String(n))
    }
    render(createElement(Counter, {}), root)
    await flush()
    eq(root._children[0]._children[0].nodeValue, "0", "initial = 0")

    setter(1); await flush()
    eq(root._children[0]._children[0].nodeValue, "1", "commit #2 must show '1'")

    setter(2); await flush()
    eq(root._children[0]._children[0].nodeValue, "2", "commit #3 must show '2'")

    setter(3); await flush()
    eq(root._children[0]._children[0].nodeValue, "3", "commit #4 must show '3'")
  })

  // ── T6: functional updater (prev => next) ────────────────────────────────────
  await test("T6  functional setState updater accumulates correctly", async root => {
    let setter
    function Counter() {
      const [n, setN] = useState(10)
      setter = setN
      return createElement("div", {}, String(n))
    }
    render(createElement(Counter, {}), root)
    await flush()

    setter(prev => prev + 1); await flush()
    eq(root._children[0]._children[0].nodeValue, "11", "10 + 1 = 11")

    setter(prev => prev * 2); await flush()
    eq(root._children[0]._children[0].nodeValue, "22", "11 * 2 = 22")
  })

  // ── T7: multiple setStates in the same tick batch into ONE commit ─────────────
  await test("T7  synchronous setStates batch into a single re-render", async root => {
    let setA, setB, renderCount = 0
    function Comp() {
      renderCount++
      const [a, sA] = useState("a")
      const [b, sB] = useState("b")
      setA = sA; setB = sB
      return createElement("div", {}, a + b)
    }
    render(createElement(Comp, {}), root)
    await flush()
    const baseline = renderCount   // 1

    setA("x"); setB("y")           // synchronous — should produce ONE extra render
    await flush()
    eq(root._children[0]._children[0].nodeValue, "xy", "both vars must be updated")
    eq(renderCount - baseline, 1, "only one extra render (batched, not two)")
  })

  // ── T8: keyed list append preserves existing DOM nodes ───────────────────────
  await test("T8  keyed list append creates new node without replacing existing", async root => {
    let setList
    function List() {
      const [items, setItems] = useState(["a"])
      setList = setItems
      return createElement("ul", {}, ...items.map(k => createElement("li", { key: k }, k)))
    }
    render(createElement(List, {}), root)
    await flush()
    const ul = root._children[0]
    eq(ul._children.length, 1)
    const firstLi = ul._children[0]   // capture reference

    setList(prev => [...prev, "b"])
    await flush()
    eq(ul._children.length, 2, "two li nodes after append")
    assert(ul._children[0] === firstLi, "first li DOM node must be reused (identity preserved)")
    eq(ul._children[1]._children[0].nodeValue, "b", "second li must contain 'b'")
  })

  // ── T9: keyed list remove deletes only the removed DOM node ──────────────────
  await test("T9  keyed list remove deletes correct DOM node", async root => {
    let setList
    function List() {
      const [items, setItems] = useState(["a", "b", "c"])
      setList = setItems
      return createElement("ul", {}, ...items.map(k => createElement("li", { key: k }, k)))
    }
    render(createElement(List, {}), root)
    await flush()
    const ul = root._children[0]
    eq(ul._children.length, 3)

    setList(["a", "c"])
    await flush()
    eq(ul._children.length, 2, "'b' must be removed")
    eq(ul._children[0]._children[0].nodeValue, "a")
    eq(ul._children[1]._children[0].nodeValue, "c")
  })

  // ── T10: plain prop update (text content change) ─────────────────────────────
  await test("T10 prop update changes DOM text content", async root => {
    let setLabel
    function Label() {
      const [text, setText] = useState("original")
      setLabel = setText
      return createElement("p", {}, text)
    }
    render(createElement(Label, {}), root)
    await flush()
    eq(root._children[0]._children[0].nodeValue, "original")

    setLabel("updated")
    await flush()
    eq(root._children[0]._children[0].nodeValue, "updated")
  })

  // ── T11: array-of-objects state — addItem pattern (direct simulation of app) ─
  // This reproduces the exact bug scenario: canvas items added one by one.
  await test("T11 addItem array pattern: three sequential adds all render", async root => {
    let addItem
    function App() {
      const [items, setItems] = useState([])
      addItem = type => setItems(prev => [...prev, { id: prev.length, type }])
      return createElement("div", {},
        ...items.map(item => createElement("span", { key: item.id }, item.type))
      )
    }
    render(createElement(App, {}), root)
    await flush()
    const container = root._children[0]
    eq(container._children.length, 0, "initial: empty canvas")

    addItem("Heading"); await flush()
    eq(container._children.length, 1, "after 1st add: 1 item")
    eq(container._children[0]._children[0].nodeValue, "Heading")

    addItem("Paragraph"); await flush()
    eq(container._children.length, 2, "after 2nd add: 2 items")
    eq(container._children[1]._children[0].nodeValue, "Paragraph")

    addItem("Button"); await flush()
    eq(container._children.length, 3, "after 3rd add: 3 items")
    eq(container._children[2]._children[0].nodeValue, "Button")
  })

  // ── T12: multi-state component — addItem + selectedId pattern ─────────────────
  // The real app calls setItems, setSelectedId, and setActiveTab in the same handler.
  await test("T12 multi-state: synchronous setItems+setSelectedId updates both", async root => {
    let addItem
    function App() {
      const [items,      setItems]      = useState([])
      const [selectedId, setSelectedId] = useState(null)
      addItem = type => {
        const id = "item-" + items.length  // closure over current items
        setItems(prev => [...prev, { id, type }])
        setSelectedId(id)
      }
      return createElement("div", { "data-selected": selectedId || "" },
        ...items.map(item =>
          createElement("span", { key: item.id, "data-id": item.id }, item.type)
        )
      )
    }
    render(createElement(App, {}), root)
    await flush()
    const div = root._children[0]
    eq(div._attrs["data-selected"], "", "nothing selected initially")

    addItem("Heading"); await flush()
    eq(div._children.length, 1, "1 item in canvas after add")
    eq(div._attrs["data-selected"], "item-0", "selectedId must update to item-0")

    addItem("Paragraph"); await flush()
    eq(div._children.length, 2, "2 items after second add")
    // selectedId closes over stale `items` (length=1 at call time), so id="item-1"
    eq(div._attrs["data-selected"], "item-1", "selectedId must update to item-1")
  })

  // ── T13: useEffect fires after commit, cleanup on re-render ──────────────────
  await test("T13 useEffect fires after commit and cleans up on re-render", async root => {
    const log = []
    let setter
    function Comp() {
      const [n, setN] = useState(0)
      setter = setN
      useEffect(() => {
        log.push("mount:" + n)
        return () => log.push("cleanup:" + n)
      }, [n])
      return createElement("div", {}, String(n))
    }
    render(createElement(Comp, {}), root)
    await flush()
    assert(log.includes("mount:0"), "mount:0 must fire after initial commit")
    assert(!log.includes("cleanup:0"), "cleanup:0 must not fire yet")

    setter(1); await flush()
    assert(log.includes("cleanup:0"), "cleanup:0 must fire before next effect")
    assert(log.includes("mount:1"),   "mount:1 must fire after second commit")
  })

  // ── T14: mixed keyed+unkeyed siblings — the palette panel bug ────────────────
  // Palette renders [p.title (no key), button(key=H), button(key=P), ...].
  // hasKeys=true, so the keyed cleanup walk runs.  It incorrectly marks the
  // already-matched keyless p as DELETION, detaches its DOM on commit 2, then
  // tries removeChild again on commit 3 → DOMException → try/catch swallows it
  // → wipRoot=null, currentRoot frozen → every subsequent setState is a no-op.
  await test("T14 mixed keyed+unkeyed: keyless sibling survives re-renders", async root => {
    let setter
    function Panel() {
      const [items, setItems] = useState(["a"])
      setter = setItems
      // p is unkeyed, spans are keyed — exactly like the palette panel
      return createElement("div", {},
        createElement("p", {}, "title"),
        ...items.map(k => createElement("span", { key: k }, k))
      )
    }
    render(createElement(Panel, {}), root)
    await flush()
    const div = root._children[0]
    eq(div._children.length, 2, "initial: p + 1 span")
    eq(div._children[0].tagName, "P", "p title present initially")

    setter(prev => [...prev, "b"])
    await flush()
    eq(div._children.length, 3, "after 1st add: p + 2 spans")
    eq(div._children[0].tagName, "P", "p title must still be in DOM after 2nd render")

    setter(prev => [...prev, "c"])
    await flush()
    eq(div._children.length, 4, "after 2nd add: p + 3 spans — THIS IS WHERE IT USED TO CRASH")
    eq(div._children[0].tagName, "P", "p title must still be in DOM after 3rd render")
    eq(div._children[3]._children[0].nodeValue, "c", "3rd span shows 'c'")
  })

  // ─── Summary ──────────────────────────────────────────────────────────────────
  const total = _passed + _failed
  console.log(`\n${"─".repeat(52)}`)
  if (_failed === 0) {
    console.log(`  \x1b[32m${_passed}/${total} passed — all green\x1b[0m`)
  } else {
    console.log(`  \x1b[31m${_failed} FAILED\x1b[0m  /  ${_passed} passed  /  ${total} total`)
    console.log("\nFailed:")
    _failures.forEach(({ name, err }) =>
      console.log(`  \x1b[31m${name}\x1b[0m\n    ${err.message}`)
    )
  }
  console.log()
  process.exit(_failed > 0 ? 1 : 0)
})()
