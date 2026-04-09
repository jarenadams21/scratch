function createElement(type, props, ...children) {
return {
type,
props: {
...props,
children,
},
}
}

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

const isEvent = key => key.startsWith("on")
const isProperty = key => key !== "children" && !isEvent(key)
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)

function updateDom(dom, prevProps, nextProps) {
Object.keys(prevProps).filter(isEvent)
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

function commitRoot() {
deletions.forEach(commitWork)
commitWork(wipRoot.child)
currentRoot = wipRoot
wipRoot = null
}

function commitWork(fiber) {
if (!fiber) {
return
}

let domParentFiber = fiber.parent
while(!domParentFiber.dom) {
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

function commitDeletion(fiber, domParent) {
if (fiber.dom) {
domParent.removeChild(fiber.dom)
} else {
commitDeletion(fiber.child, domParent)
}
}

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

let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null

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