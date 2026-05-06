// Without this TypeScript errors on lowercase tags (<div>, <h1> etc) — it has no built-in
// HTML element list when not using @types/react.
declare namespace JSX {
  interface IntrinsicElements {
    [tag: string]: any
  }
}

// Module-level globals shared across all phases of the fiber work loop.
// ES module bindings can't be mutated by importers, so shared state lives here.
let nextUnitOfWork = null
let currentRoot    = null
let wipRoot        = null
let deletions      = null

let wipFiber  = null
let hookIndex = null

function processText(text) {
  if (typeof text !== 'string' && typeof text !== 'number') {
    console.warn('Text node received non-primitive:', text)
  }
}

function createTextElement(text) {
  processText(text)
  return {
    type: 'TEXT_ELEMENT',
    props: { nodeValue: text, children: [] },
  }
}

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === 'object' ? child : createTextElement(child)
      ),
    },
  }
}

function createDom(fiber) {
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)
  updateDom(dom, {}, fiber.props)
  return dom
}

const isEvent    = key => key.startsWith('on')
const isProperty = key => key !== 'children' && !isEvent(key) && key !== 'ref' && key !== 'key'
const isNew      = (prev, next) => key => prev[key] !== next[key]
const isGone     = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => dom.removeEventListener(name.toLowerCase().substring(2), prevProps[name]))

  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => { dom[name] = '' })

  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => { dom[name] = nextProps[name] })

  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => dom.addEventListener(name.toLowerCase().substring(2), nextProps[name]))
}

function commitRoot() {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function maybeCallRef(fiber) {
  if (fiber.props.ref) fiber.props.ref(fiber.dom)
}

function commitWork(fiber) {
  if (!fiber) return

  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) domParentFiber = domParentFiber.parent
  const domParent = domParentFiber.dom

  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
    maybeCallRef(fiber)
  } else if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, domParent)
    return  // don't walk old fiber's subtree after deletion
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    maybeCallRef(fiber)
  }

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// Safari never shipped requestIdleCallback — fall back to setTimeout with a fixed 50ms budget.
const scheduleWork: (cb: (deadline: { timeRemaining: () => number }) => void) => void =
  typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 50 }), 1)

function workLoop(deadline) {
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }
  if (!nextUnitOfWork && wipRoot) commitRoot()
  scheduleWork(workLoop)
}

scheduleWork(workLoop)

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  if (fiber.child) return fiber.child
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) return nextFiber.sibling
    nextFiber = nextFiber.parent
  }
}

function updateFunctionComponent(fiber) {
  wipFiber  = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

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
  actions.forEach(action => { hook.state = action(hook.state) })

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

function updateHostComponent(fiber) {
  if (!fiber.dom) fiber.dom = createDom(fiber)
  reconcileChildren(fiber, fiber.props.children)
}

// Same type + same key → UPDATE (reuse DOM, patch props)
// New type or new key  → PLACEMENT (create new DOM node)
// Old only             → DELETION (schedule for removal)
function reconcileChildren(wipFiber, elements) {
  let index      = 0
  let oldFiber   = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index]
    let newFiber  = null

    const sameType = oldFiber && element && element.type == oldFiber.type
    const sameKey  = !oldFiber || !element ||
      (oldFiber.props?.key === element.props?.key)

    if (sameType && sameKey) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }

    if (element && (!sameType || !sameKey)) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      }
    }

    if (oldFiber && (!sameType || !sameKey)) {
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    if (oldFiber) oldFiber = oldFiber.sibling

    if (newFiber && !wipFiber.child) {
      wipFiber.child = newFiber
    } else if (newFiber && prevSibling) {
      prevSibling.sibling = newFiber
    }

    if (newFiber) prevSibling = newFiber
    index++
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: { children: [element] },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot
}

export { createElement, render, useState }
