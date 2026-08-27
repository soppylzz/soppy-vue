import { createVNode, isVNode, cloneVNode, Fragment, Text, Comment } from "@soppy-vue/runtime-core"
import {
  normalizeVNode,
  mergeProps,
  isSameVNodeType,
  invokeVNodeHook,
} from "@soppy-vue/runtime-core/vnode"
import { normalizeClass, normalizeStyle } from "@soppy-vue/runtime-core/props"
import { ShapeFlags, PatchFlags } from "@soppy-vue/shared"

describe("createVNode", () => {
  it("isVNode distinguishes vnodes from plain objects", () => {
    expect(isVNode(createVNode("div"))).toBe(true)
    expect(isVNode({})).toBe(false)
    expect(isVNode(null)).toBe(false)
  })

  it("element vnode has ELEMENT shapeFlag and string type", () => {
    const vnode = createVNode("div")
    expect(vnode.type).toBe("div")
    expect(vnode.shapeFlag & ShapeFlags.ELEMENT).toBeTruthy()
  })

  it("initializes key/el/component to null", () => {
    const vnode = createVNode("div")
    expect(vnode.key).toBeNull()
    expect(vnode.el).toBeNull()
    expect(vnode.component).toBeNull()
  })

  it("object type -> STATEFUL_COMPONENT; function type -> FUNCTIONAL_COMPONENT", () => {
    expect(createVNode({}).shapeFlag & ShapeFlags.STATEFUL_COMPONENT).toBeTruthy()
    expect(createVNode(() => {}).shapeFlag & ShapeFlags.FUNCTIONAL_COMPONENT).toBeTruthy()
  })

  it("special types (Text/Comment/Fragment) have shapeFlag 0", () => {
    expect(createVNode(Text).shapeFlag).toBe(0)
    expect(createVNode(Comment).shapeFlag).toBe(0)
    expect(createVNode(Fragment).shapeFlag).toBe(0)
  })
})

describe("children normalization (createVNode)", () => {
  it("string children -> TEXT_CHILDREN flag + string children", () => {
    const vnode = createVNode("div", null, "hi")
    expect(vnode.shapeFlag & ShapeFlags.TEXT_CHILDREN).toBeTruthy()
    expect(vnode.children).toBe("hi")
  })

  it("array children -> ARRAY_CHILDREN flag", () => {
    const vnode = createVNode("div", null, [createVNode("span")])
    expect(vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN).toBeTruthy()
  })

  it("null/undefined children -> null", () => {
    expect(createVNode("div", null, null).children).toBeNull()
    expect(createVNode("div", null, undefined).children).toBeNull()
  })
})

describe("normalizeVNode", () => {
  it("null/false/undefined -> Comment vnode", () => {
    expect(normalizeVNode(null).type).toBe(Comment)
    expect(normalizeVNode(false).type).toBe(Comment)
    expect(normalizeVNode(undefined).type).toBe(Comment)
  })

  it("string/number -> Text vnode with String(value)", () => {
    expect(normalizeVNode("hi").type).toBe(Text)
    expect(normalizeVNode("hi").children).toBe("hi")
    expect(normalizeVNode(42).type).toBe(Text)
    expect(normalizeVNode(42).children).toBe("42")
  })

  it("array -> Fragment vnode wrapping the array", () => {
    const a = createVNode("span")
    const frag = normalizeVNode([a])
    expect(frag.type).toBe(Fragment)
    expect(frag.children).toEqual([a])
  })

  it("object vnode -> returned as-is (not mounted)", () => {
    const vnode = createVNode("div")
    expect(normalizeVNode(vnode)).toBe(vnode)
  })
})

describe("normalizeClass / normalizeStyle", () => {
  it("normalizeClass handles string, array, object", () => {
    expect(normalizeClass("a")).toBe("a")
    expect(normalizeClass(["a", "b"])).toBe("a b")
    expect(normalizeClass({ a: true, b: false })).toBe("a")
  })

  it("normalizeStyle passes through strings/objects and merges arrays", () => {
    expect(normalizeStyle("color:red")).toBe("color:red")
    expect(normalizeStyle({ color: "red" })).toEqual({ color: "red" })
    expect(normalizeStyle([{ color: "red" }, { background: "blue" }])).toEqual({
      color: "red",
      background: "blue",
    })
  })
})

describe("cloneVNode", () => {
  it("returns a new vnode with same type/children/shapeFlag", () => {
    const vnode = createVNode("div", { class: "a" }, "hi")
    const cloned = cloneVNode(vnode)
    expect(cloned).not.toBe(vnode)
    expect(cloned.type).toBe(vnode.type)
    expect(cloned.children).toBe(vnode.children)
    expect(cloned.shapeFlag).toBe(vnode.shapeFlag)
  })

  it("with extraProps, patchFlag gains FULL_PROPS (except Fragment)", () => {
    const vnode = createVNode("div", { id: "a" })
    const cloned = cloneVNode(vnode, { class: "b" })
    expect(cloned.patchFlag & PatchFlags.FULL_PROPS).toBeTruthy()

    const frag = createVNode(Fragment)
    const fragClone = cloneVNode(frag, { class: "b" })
    expect(fragClone.patchFlag & PatchFlags.FULL_PROPS).toBe(0)
  })

  it("merges props (class via mergeProps)", () => {
    const vnode = createVNode("div", { class: "a" })
    const cloned = cloneVNode(vnode, { class: "b" })
    expect(cloned.props!.class).toBe("a b")
  })
})

describe("mergeProps", () => {
  it("merges class across props objects", () => {
    expect(mergeProps({ class: "a" }, { class: "b" }).class).toBe("a b")
  })

  it("merges style", () => {
    const merged = mergeProps({ style: { color: "red" } }, { style: { background: "blue" } })
    expect(merged.style).toEqual({ color: "red", background: "blue" })
  })

  it("merges on* handlers into arrays, deduping by identity", () => {
    const fn1 = () => {}
    const fn2 = () => {}
    const merged = mergeProps({ onClick: fn1 }, { onClick: fn2 })
    expect(merged.onClick).toEqual([fn1, fn2])

    const deduped = mergeProps({ onClick: [fn1] }, { onClick: fn1 })
    expect(deduped.onClick).toEqual([fn1])
  })

  it("non class/style/on keys: later wins", () => {
    expect(mergeProps({ id: "a" }, { id: "b" }).id).toBe("b")
  })
})

describe("isSameVNodeType", () => {
  it("same type + same key -> true; different type or key -> false", () => {
    const a = createVNode("div", { key: 1 })
    const b = createVNode("div", { key: 1 })
    expect(isSameVNodeType(a, b)).toBe(true)

    expect(isSameVNodeType(a, createVNode("div", { key: 2 }))).toBe(false)
    expect(isSameVNodeType(a, createVNode("span", { key: 1 }))).toBe(false)
  })
})

describe("invokeVNodeHook", () => {
  it("calls a mount hook with the vnode", () => {
    let seen: any
    const vnode = createVNode("div", {
      // vnode hooks carry a brand (`VNodeMountSymbol`); cast to satisfy the type
      onVNodeMounted: ((v: any) => {
        seen = v
      }) as any,
    })
    invokeVNodeHook("onVNodeMounted", vnode)
    expect(seen).toBe(vnode)
  })

  it("invokes all hooks in an array, passing (vnode, prevVNode) for update hooks", () => {
    const calls: any[] = []
    const vnode = createVNode("div", {
      onVNodeUpdated: [
        ((v: any, prev: any) => calls.push(["a", v, prev])) as any,
        ((v: any, prev: any) => calls.push(["b", v, prev])) as any,
      ],
    })
    const prev = createVNode("div")
    invokeVNodeHook("onVNodeUpdated", vnode, prev)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual(["a", vnode, prev])
    expect(calls[1]).toEqual(["b", vnode, prev])
  })
})
