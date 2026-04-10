// Tells TypeScript that any lowercase tag name is a valid JSX element.
// Without this, it errors on <h1>, <div>, etc. because it has no built-in
// HTML element list when not using @types/react.
declare namespace JSX {
  interface IntrinsicElements {
    [tag: string]: any
  }
}

// ─── Shared render state ────────────────────────────────────────────────────
// These are module-level globals because every function in this file needs
// to read and write the same values. Splitting across files would require
// a shared state object since ES module bindings can't be mutated by importers.

let nextUnitOfWork = null  // next fiber the work loop will process
let currentRoot    = null  // the committed fiber tree — what's on screen right now
let wipRoot        = null  // the fiber tree currently being built
let deletions      = null  // fibers scheduled for removal on the next commit

let wipFiber  = null  // the function component fiber currently being rendered
let hookIndex = null  // which hook call we're on within the current render

// TOOLING `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Simple function to encourage smart usage of text throughout app
function processText(text) {
  if(typeof text !== "string" && typeof text !== "number") {
    console.warn("Text should be a string or number:", text)
  }

  // TODO: avoid functions, malicous objects

  if (text.length > 10) {
    console.warn("Text is too long:", text)
  }
}
// ─── Virtual DOM ────────────────────────────────────────────────────────────

// Wraps a raw string or number into a proper virtual node so the rest of
// the pipeline (reconciler, createDom) can treat every child the same way.
// TEXT_ELEMENT is a sentinel type; createDom handles it via document.createTextNode.
function createTextElement(text) {
  processText(text)
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// Builds a virtual DOM node — a plain object describing what should exist on screen.
// `type` is a tag name ("div", "h1") or a function component.
// Primitive children (strings, numbers) get wrapped as TEXT_ELEMENTs so every
// child in the tree is always a proper object with a type and props.
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  }
}

// Turns a fiber's virtual description into a real DOM node.
// Text nodes require a separate API, so TEXT_ELEMENT is special-cased.
// Uses updateDom with empty prevProps to apply initial props — this ensures
// event handlers go through addEventListener instead of being set as plain
// DOM properties (dom["onClick"] = fn does nothing; addEventListener does).
function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)

  return dom
}

// ─── Prop helpers ────────────────────────────────────────────────────────────

const isEvent    = key => key.startsWith("on")                     // "onClick", "onInput", etc.
const isProperty = key => key !== "children" && !isEvent(key)      // plain DOM attributes
const isNew      = (prev, next) => key => prev[key] !== next[key]  // value changed between renders
const isGone     = (prev, next) => key => !(key in next)           // prop was removed entirely

// Syncs a real DOM node to match incoming props from a re-render.
// Three passes, in order:
//   1. Remove event listeners that changed or are no longer present.
//   2. Blank out any plain props that were removed.
//   3. Set new or changed plain props, then attach updated event listeners.
function updateDom(dom, prevProps, nextProps) {
  // Remove stale or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // Remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // Add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

// ─── Commit phase ────────────────────────────────────────────────────────────

// Flushes the finished work-in-progress tree to the real DOM.
// Deletions go first so removed nodes are cleared before new ones are inserted.
// After the commit, wip becomes the current tree and wipRoot is nulled out.
function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

// Applies a fiber's effect tag to the DOM, then walks into children and siblings.
// Function components don't own DOM nodes, so we climb the parent chain to find
// the nearest ancestor that does before touching the DOM.
function commitWork(fiber) {
  if (!fiber) {
    return
  }

  // Walk up until we hit a fiber with a real DOM node.
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent)
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  }

  // Must be outside the if-else — every fiber needs to walk its subtree
  // regardless of its own effect tag.
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

// Removes a fiber's real DOM node from its parent.
// If the fiber has no DOM node (it's a function component), recurse into its
// child until we reach a node that does.
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// ─── Work loop ───────────────────────────────────────────────────────────────

// The main render loop, driven by requestIdleCallback.
// Processes fiber work in chunks — as much as fits within the browser's idle time —
// then hands control back so the page stays responsive.
// When there's no work left and a wip tree is ready, it commits everything to the DOM.
function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

// Processes a single fiber and returns the next one to work on.
// Traversal order: child first, then sibling, then climb back up and over.
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

// ─── Component updaters ──────────────────────────────────────────────────────

// Renders a function component — calls it to get its elements, then reconciles
// those against the old fiber tree.
function updateFunctionComponent(fiber) {
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

// The useState hook.
// On first render, initializes state to `initial`.
// On re-renders, replays any queued setState actions against the previous state
// to arrive at the current value before the component function runs.
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })

  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

// For native DOM elements — creates the DOM node the first time,
// then reconciles its children against the previous fiber tree.
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

// ─── Reconciler ──────────────────────────────────────────────────────────────

// The diff step. Walks old fibers and new elements side by side and decides
// what needs to happen to each node:
//   Same type  → UPDATE    (reuse the existing DOM node, patch its props)
//   New type   → PLACEMENT (needs a brand new DOM node)
//   Old only   → DELETION  (no matching new element, schedule for removal)
function reconcileChildren(wipFiber, elements) {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber = null

    const sameType = oldFiber && element && element.type == oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }

    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }

    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    // Wire the new fiber into the tree as either the first child or a sibling.
    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Entry point for a render cycle. Sets up a work-in-progress root fiber
// that points back to the current tree via `alternate` for diffing.
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

const engine = { createElement, render, useState }

// ─── App ─────────────────────────────────────────────────────────────────────

function Counter() {
  const [state, setState] = engine.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}

const element = <Counter />
const container = document.getElementById("root")
engine.render(element, container)
