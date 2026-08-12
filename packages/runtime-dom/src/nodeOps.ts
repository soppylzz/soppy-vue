const nodeOps = {
  insert: (el, parent, anchor) => parent.insertBefore(el, anchor || null),
  remove(el) {
    const parent = el.parentNode
    parent && parent.removeChild(el)
  },
  createElement: (type) => document.createElement(type),
  setElementText: (el, text) => (el.textContent = text),

  createText: (text) => document.createTextNode(text),
  setText: (node, text) => (node.nodeValue = text),

  parentNode: (node) => node.parentNode,
  nextSibling: (node) => node.nextSibling,
}

export { nodeOps }
