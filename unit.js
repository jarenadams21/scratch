let nextUnitOfWork = null

function workLoop(deadline) {
let shouldYield = false
while(nextUnitOfWork && !shouldYield) {
nextUnitOfWork = performUnitOfWork(
nextUnitOfWork)
shouldYield = deadline.timeRemaining() < 1
}

if (!nextUnitOfWork && wipRoot) {
commitRoot()
}

requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

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
    while(nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}

let wipFiber = null
let hookIndex = null

function updateFunctionComponent(fiber) {
wipFiber = fiber
hookIndex = 0
wipFiber.hooks = []
    const children = [fiber.type(fiber.props)]
reconcileChildren(fiber, children)
}


function useState(initial) {
const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
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
return [hook.state]
}

function updateHostComponent(fiber) {
if (!fiber.dom) {
fiber.dom = createDom(fiber)
}
reconcileChildren(fiber, fiber.props.children)
}

function reconcileChildren(wipFiber, elements) {
let index = 0
let oldFiber = wipFiber.alternate && wipFiber.alternate.child
let prevSibling = null

while(index < elements.length || oldFiber != null) {
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
}
}