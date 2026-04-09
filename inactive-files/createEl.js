// Builds a virtual DOM node — just a plain object describing what should exist on screen.
// `type` is a tag name ("div", "h1") or a function component.
// `children` is variadic so JSX can pass any number of child nodes;
// they get folded into props so the whole description travels as one object.
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children,
    },
  }
}

// Turns a fiber's virtual description into a real DOM node.
// Text nodes require a separate API, so TEXT_ELEMENT is special-cased.
// Only non-children props get stamped onto the node — children are
// handled by the fiber tree, not set here.
function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type)

  const isProperty = key => key !== "children"
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = fiber.props[name]
    })

  return dom
}

// Prop classifier helpers — used by updateDom to decide what to do with each key.
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
    // update dom
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)

    commitWork(fiber.child)
    commitWork(fiber.sibling)
  }
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

// Entry point for a render cycle. Sets up a new work-in-progress root fiber
// that points back to the current tree via `alternate` for diffing.
// Putting wipRoot into nextUnitOfWork lets the work loop in unit.js pick it up.
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

// Global render state shared with unit.js.
let nextUnitOfWork = null  // next fiber the work loop will process
let currentRoot    = null  // the committed fiber tree — what's actually on screen right now
let wipRoot        = null  // the fiber tree currently being built
let deletions      = null  // fibers scheduled for removal on the next commit

const engine = {
  createElement,
  render,
  useState,
}

/** @jsx engine.createElement */
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
