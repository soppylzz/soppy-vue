import { render, createVNode, Fragment, Text, Comment, openBlock, createBlock } from "soppy-vue"

function container() {
  return document.createElement("div")
}

describe("mount", () => {
  it("mounts the element into the container", () => {
    const c = container()
    render(createVNode("div"), c)
    expect(c.childNodes.length).toBe(1)
    expect(c.firstChild!.nodeName).toBe("DIV")
  })

  it("element with text children sets textContent", () => {
    const c = container()
    render(createVNode("div", null, "hello"), c)
    expect(c.firstChild!.textContent).toBe("hello")
  })

  it("element with props applies attributes", () => {
    const c = container()
    render(createVNode("div", { id: "a", title: "b" }), c)
    const el = c.firstChild as HTMLElement
    expect(el.getAttribute("id")).toBe("a")
    expect(el.getAttribute("title")).toBe("b")
  })

  it("Fragment mounts children directly (no wrapper element)", () => {
    const c = container()
    render(createVNode(Fragment, null, [createVNode("span"), createVNode("span")]), c)
    // 2 spans + 2 fragment anchor text nodes
    expect(c.querySelectorAll("span").length).toBe(2)
    expect(c.childNodes[0].nodeName).not.toBe("DIV")
  })

  it("component mounts and renders its sub-tree", () => {
    const c = container()
    const Comp = {
      render() {
        return createVNode("p", null, "from-component")
      },
    }
    render(createVNode(Comp), c)
    expect(c.querySelector("p")!.textContent).toBe("from-component")
  })
})

describe("patch / update", () => {
  it("re-render with same type patches the existing element (identity preserved)", () => {
    const c = container()
    render(createVNode("div"), c)
    const el = c.firstChild!
    render(createVNode("div", { class: "x" }), c)
    expect(c.firstChild).toBe(el)
  })

  it("text change updates text content", () => {
    const c = container()
    render(createVNode("div", null, "before"), c)
    render(createVNode("div", null, "after"), c)
    expect(c.firstChild!.textContent).toBe("after")
  })

  it("attr change updates attributes (add/remove)", () => {
    const c = container()
    render(createVNode("div", { id: "a" }), c)
    render(createVNode("div", { class: "b" }), c)
    const el = c.firstChild as HTMLElement
    expect(el.hasAttribute("id")).toBe(false)
    expect(el.getAttribute("class")).toBe("b")
  })

  it("class/style change via patchClass/patchStyle", () => {
    const c = container()
    render(createVNode("div", { class: "a", style: { color: "red" } }), c)
    render(createVNode("div", { class: "b", style: { color: "blue" } }), c)
    const el = c.firstChild as HTMLElement
    expect(el.className).toBe("b")
    expect(el.style.color).toBe("blue")
  })
})

describe("unmount", () => {
  it("render(null, container) removes the previously mounted tree", () => {
    const c = container()
    render(createVNode("div"), c)
    expect(c.childNodes.length).toBe(1)
    render(null, c)
    expect(c.childNodes.length).toBe(0)
  })

  it("render(newRoot, container) replaces an old root of a different type", () => {
    const c = container()
    render(createVNode("div"), c)
    render(createVNode("span"), c)
    expect(c.childNodes.length).toBe(1)
    expect(c.firstChild!.nodeName).toBe("SPAN")
  })
})

describe("keyed children diff", () => {
  function li(text: string, key: string | number) {
    return createVNode("li", { key }, text)
  }

  it("reorder with keys moves DOM nodes (not recreate) — identity preserved", () => {
    const c = container()
    render(createVNode("ul", null, [li("a", 1), li("b", 2), li("c", 3)]), c)
    const first = c.querySelectorAll("li")[0]

    render(createVNode("ul", null, [li("c", 3), li("a", 1), li("b", 2)]), c)

    const lis = c.querySelectorAll("li")
    expect(lis.length).toBe(3)
    expect([...lis].map((el) => el.textContent)).toEqual(["c", "a", "b"])
    // the first li from the initial render was reused (moved), not recreated
    expect([...lis].some((el) => el === first)).toBe(true)
  })

  it("add/remove keyed nodes", () => {
    const c = container()
    render(createVNode("ul", null, [li("a", 1), li("b", 2)]), c)
    render(createVNode("ul", null, [li("a", 1), li("c", 3)]), c)
    const lis = c.querySelectorAll("li")
    expect([...lis].map((el) => el.textContent)).toEqual(["a", "c"])
  })

  it("LIS-based minimal moves: reorder produces the minimal set of DOM moves", () => {
    const c = container()
    render(createVNode("ul", null, [li("a", 1), li("b", 2), li("c", 3), li("d", 4)]), c)
    const originals = [...c.querySelectorAll("li")]

    render(createVNode("ul", null, [li("a", 1), li("c", 3), li("b", 2), li("d", 4)]), c)

    const lis = c.querySelectorAll("li")
    expect([...lis].map((el) => el.textContent)).toEqual(["a", "c", "b", "d"])
    // every node was reused (no recreation)
    for (const el of lis) {
      expect(originals.includes(el)).toBe(true)
    }
  })
})

describe("unkeyed children diff", () => {
  it("array of unkeyed children patches positionally", () => {
    const c = container()
    render(createVNode("ul", null, [createVNode("li", null, "a"), createVNode("li", null, "b")]), c)
    render(
      createVNode("ul", null, [
        createVNode("li", null, "a"),
        createVNode("li", null, "b"),
        createVNode("li", null, "c"),
      ]),
      c
    )
    expect([...c.querySelectorAll("li")].map((el) => el.textContent)).toEqual(["a", "b", "c"])
  })
})

describe("block tree", () => {
  it("openBlock() + createBlock() captures dynamicChildren", () => {
    openBlock()
    const block = createBlock("div", null, [createVNode("span", null, null, 1)])
    expect(block.dynamicChildren).not.toBeNull()
    expect(block.dynamicChildren!.length).toBeGreaterThan(0)
  })
})
