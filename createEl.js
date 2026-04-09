function createElement(type, props, ...children) {
return {
type,
props: {
...props,
children,
},
}
}

function render(element, container) {
const dom = element.type == "TEXT_ELEMENT" ? document.createTextNode("") : document.createElement(element.type)

const isProperty = key => key !== "children"
Object.keys(element.props)
.filter(isProperty)
.forEach(name => {
dom[name] = element.props[name]
})

element.props.children.forEach(child =>
render(child, dom)
)

container.appendChild(dom)
}

let nextUnitOfWork = null

const engine = {
createElement,
render,
}

const element = engine.createElement(enginer.createElement("a",null,"sar"),
engine.createElement("b"))

// This comment allows transpiling JSX to use the function defined here
/** @jsx engine.createElement */
const element = (
<div id="moo">
<a>sipsum</a>
<b/>
</div>
)

