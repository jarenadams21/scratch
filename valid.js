// elements refer to React elements, node for DOM elements.

const element = <h1 title="grab-1">Hello</h1>
const container = document.getElementById("root")
ReactDOM.render(element, container)

/*

const element = {
// type is a string that specifies the type of the DOM node we want to create,
// its the tagName you pass to document.createElement when creating HTML element
type: "h1",
// keys and values from JSX attributes
// children is a string but usually an array with more elements (trees)
props: {
title: "grab-1",
children: "Hello",
},
}

*/

/* Nodes */
const node = document.createElement(element.type)
node["title"] = elements.props.title


// instead of setting innerText; textNode allows to treat all elements the same
const text = document.createTextNode("")
text["nodeValue"] = elements.props.children

node.appendChild(text)
container.appendChild(node)

/*
const element = (
  <div id="foo">
    <a>bar</a>
    <b />
  </div>
)
const container = document.getElementById("root")
ReactDOM.render(element, container)
*/
