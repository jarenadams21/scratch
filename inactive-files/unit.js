let nextUnitOfWork = null

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

  // All units of work are done and there's a finished tree waiting — flush it.
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

// Processes a single fiber and returns the next one to work on.
// Traversal order: child first, then sibling, then climb back up and take the next sibling.
// This depth-first walk visits every node in the tree exactly once.
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // Go deeper if there's a child.
  if (fiber.child) {
    return fiber.child
  }
  // No child — look for a sibling, then climb until we find an uncle.
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

let wipFiber  = null  // the function component fiber currently being rendered
let hookIndex = null  // tracks which hook call we're on within the current render

// Renders a function component — calls it to get its elements, then reconciles
// those against the old fiber tree. The wipFiber/hookIndex globals have to be
// set before the call so useState knows which component it belongs to.
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
  // Pull the matching hook from the previous render's fiber, if one exists.
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex]

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  // Replay all queued state updates accumulated since the last render.
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })

  // Queues an action and triggers a full re-render from the root by
  // resetting the wip tree and handing it to the work loop.
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
  return [hook.state]
}

// For native DOM elements ("div", "h1", etc.) — creates the DOM node the first time,
// then reconciles its children against the previous fiber tree.
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}

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

    // Reuse the existing DOM node — just update its props next commit.
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

    // A new element type appeared — create a fresh node on commit.
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

    // Old fiber with no matching new element — mark it for removal.
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }
  }
}
