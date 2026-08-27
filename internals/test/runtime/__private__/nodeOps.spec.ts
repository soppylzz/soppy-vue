import type { nodeOps as _nodeOps } from "@soppy-vue/runtime-dom/nodeOps"

const NODE_OPS_MODULE = "@soppy-vue/runtime-dom/nodeOps"

let nodeOps: typeof _nodeOps

describe.runIf(__DEV__)("nodeOps", () => {
  beforeAll(async () => {
    ;({ nodeOps } = await import(NODE_OPS_MODULE))
  })

  it("insert(el, parent, anchor) inserts before anchor; null anchor appends", () => {
    const parent = document.createElement("div")
    const a = document.createElement("span")
    const b = document.createElement("span")
    const c = document.createElement("span")

    nodeOps.insert(a, parent)
    expect(parent.childNodes.length).toBe(1)
    expect(parent.firstChild).toBe(a)

    nodeOps.insert(b, parent, a)
    expect(parent.childNodes.length).toBe(2)
    expect(parent.firstChild).toBe(b)
    expect(b.nextSibling).toBe(a)

    nodeOps.insert(c, parent)
    expect(parent.childNodes.length).toBe(3)
    expect(parent.lastChild).toBe(c)
  })

  it("remove(el) removes from parent; no-op if parentless", () => {
    const parent = document.createElement("div")
    const el = document.createElement("span")
    nodeOps.insert(el, parent)
    expect(parent.childNodes.length).toBe(1)

    nodeOps.remove(el)
    expect(parent.childNodes.length).toBe(0)

    // removing again is a safe no-op
    expect(() => nodeOps.remove(el)).not.toThrow()
  })

  it("createElement returns a div with tagName DIV", () => {
    const el = nodeOps.createElement("div")
    expect(el.tagName).toBe("DIV")
  })

  it("setElementText sets textContent", () => {
    const el = document.createElement("div")
    nodeOps.setElementText(el, "hi")
    expect(el.textContent).toBe("hi")
  })

  it("createText returns a text node with nodeValue hi", () => {
    const node = nodeOps.createText("hi")
    expect(node.nodeType).toBe(3)
    expect(node.nodeValue).toBe("hi")
  })

  it("createComment returns a comment node with data hi", () => {
    const node = nodeOps.createComment("hi")
    expect(node.nodeType).toBe(8)
    expect((node as Comment).data).toBe("hi")
  })

  it("setText sets nodeValue", () => {
    const node = document.createTextNode("old")
    nodeOps.setText(node, "x")
    expect(node.nodeValue).toBe("x")
  })

  it("parentNode returns the parent element", () => {
    const parent = document.createElement("div")
    const child = document.createElement("span")
    nodeOps.insert(child, parent)
    expect(nodeOps.parentNode(child)).toBe(parent)
  })

  it("nextSibling returns the next sibling or null", () => {
    const parent = document.createElement("div")
    const a = document.createElement("span")
    const b = document.createElement("span")
    nodeOps.insert(a, parent)
    nodeOps.insert(b, parent)

    expect(nodeOps.nextSibling(a)).toBe(b)
    expect(nodeOps.nextSibling(b)).toBeNull()
  })

  it("querySelector delegates to document.querySelector", () => {
    const el = document.createElement("div")
    el.className = "target"
    document.body.appendChild(el)
    expect(nodeOps.querySelector(".target")).toBe(el)
    document.body.removeChild(el)
  })
})
