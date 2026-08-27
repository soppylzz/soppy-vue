import { getCurrentInstance } from "@soppy-vue/runtime-core"
import {
  createComponentInstance,
  setupComponent,
  isStatefulComponent,
  getExposeProxy,
  getComponentName,
} from "@soppy-vue/runtime-core/component"
import {
  shouldUpdateComponent,
  renderComponentRoot,
} from "@soppy-vue/runtime-core/component/renderUtils"
import { createVNode, Comment } from "@soppy-vue/runtime-core/vnode"
import { ref, isRef } from "@soppy-vue/reactivity"
import { PatchFlags } from "@soppy-vue/shared"

describe("createComponentInstance", () => {
  it("assigns an incrementing uid; parent/root set", () => {
    const a = createComponentInstance(createVNode({}) as any, null)
    const b = createComponentInstance(createVNode({}) as any, null)
    expect(b.uid).toBe(a.uid + 1)

    const child = createComponentInstance(createVNode({}) as any, a)
    expect(child.parent).toBe(a)
    expect(child.root).toBe(a)
    expect(a.root).toBe(a)
  })

  it("provides inherits parent's provides (or Object.create(null) for root)", () => {
    const root = createComponentInstance(createVNode({}) as any, null)
    expect(Object.getPrototypeOf(root.provides)).toBeNull()

    const child = createComponentInstance(createVNode({}) as any, root)
    expect(child.provides).toBe(root.provides)
  })

  it("emit is bound to the instance; ctx = { _: instance }", () => {
    const vnode = createVNode({}) as any
    const instance = createComponentInstance(vnode, null)
    expect(typeof instance.emit).toBe("function")
    expect(instance.ctx._).toBe(instance)
  })
})

describe("setupComponent / setupStatefulComponent", () => {
  it("setup() returning a state object -> instance.setupState = proxyRefs(state)", () => {
    const Component = {
      setup() {
        return { count: ref(0) }
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    expect(instance.setupState.count).toBe(0)
    expect(isRef((instance.setupState as any).count)).toBe(false)
  })

  it("setup() returning a render function -> instance.render set", () => {
    const render = () => createVNode("div")
    const Component = {
      setup() {
        return render
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    expect(instance.render).toBe(render)
  })

  it("setup() with length > 1 receives a setupContext (attrs/slots/emit/expose)", () => {
    let ctx: any
    const Component = {
      setup(_props: any, setupContext: any) {
        ctx = setupContext
        return {}
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    expect(ctx).toBeTruthy()
    expect(typeof ctx.emit).toBe("function")
    expect(typeof ctx.expose).toBe("function")
    expect(ctx.slots).toBeDefined()
    expect(ctx.attrs).toBeDefined()
  })

  it("getCurrentInstance() is the instance inside setup()", () => {
    let seen: any = null
    const Component = {
      setup() {
        seen = getCurrentInstance()
        return {}
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    expect(seen).toBe(instance)
    expect(getCurrentInstance()).toBeNull()
  })

  it("when no setup, instance.render = Component.render || NOOP", () => {
    const noRender = createComponentInstance(createVNode({}) as any, null)
    setupComponent(noRender)
    expect(typeof noRender.render).toBe("function")
    // the fallback render is a NOOP, cast away the 5-arg InternalRenderFunction signature
    expect((noRender.render as unknown as () => void)()).toBeUndefined()

    const render = () => createVNode("div")
    const withRender = createComponentInstance(createVNode({ render }) as any, null)
    setupComponent(withRender)
    expect(withRender.render).toBe(render)
  })
})

describe("isStatefulComponent", () => {
  it("stateful (object type) -> true; functional (function type) -> false", () => {
    const stateful = createComponentInstance(createVNode({}) as any, null)
    expect(isStatefulComponent(stateful)).toBe(true)

    const functional = createComponentInstance(createVNode(() => {}) as any, null)
    expect(isStatefulComponent(functional)).toBe(false)
  })
})

describe("shouldUpdateComponent", () => {
  function makeVNode(component: any, props: any = null, patchFlag = PatchFlags.BAIL) {
    const vnode = createVNode(component, props, null, patchFlag) as any
    vnode.component = createComponentInstance(vnode, null)
    return vnode
  }

  it("same props object -> false (fast path)", () => {
    const Comp = {}
    const props = { foo: 1 }
    const prev = makeVNode(Comp, props)
    const next = makeVNode(Comp, props)
    expect(shouldUpdateComponent(prev, next)).toBe(false)
  })

  it("props changed -> true", () => {
    const Comp = {}
    const prev = makeVNode(Comp, { foo: 1 })
    const next = makeVNode(Comp, { foo: 2 })
    expect(shouldUpdateComponent(prev, next)).toBe(true)
  })

  it("emits-listener changes are ignored", () => {
    const Comp = { emits: ["change"] }
    const fn1 = () => {}
    const fn2 = () => {}
    const prev = makeVNode(Comp, { onChange: fn1 })
    const next = makeVNode(Comp, { onChange: fn2 })
    expect(shouldUpdateComponent(prev, next)).toBe(false)
  })

  it("patchFlag & FULL_PROPS uses the full props diff path", () => {
    const Comp = {}
    const prev = makeVNode(Comp, { foo: 1 })
    const next = createVNode(Comp, { foo: 2 }, null, PatchFlags.FULL_PROPS) as any
    expect(shouldUpdateComponent(prev, next)).toBe(true)
  })
})

describe("renderComponentRoot", () => {
  it("stateful: calls render with (proxy, props, setupState, data, ctx) and normalizes result", () => {
    let args: any[] = []
    let thisValue: any
    const Component = {
      render(...a: any[]) {
        args = a
        thisValue = this
        return "text"
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    const root = renderComponentRoot(instance)

    expect(thisValue).toBe(instance.proxy)
    expect(args[0]).toBe(instance.proxy)
    expect(args[1]).toBe(instance.props)
    expect(args[2]).toBe(instance.setupState)
    expect(args[3]).toBe(instance.data)
    expect(args[4]).toBe(instance.ctx)
    // string result normalized to a Text vnode
    expect(root).not.toBe("text")
  })

  it("functional: calls with (props, {attrs, slots, emit})", () => {
    let args: any[] = []
    const Component = (props: any, ctx: any) => {
      args = [props, ctx]
      return createVNode("div")
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    renderComponentRoot(instance)
    expect(args[0]).toBe(instance.props)
    expect(args[1].attrs).toBe(instance.attrs)
    expect(args[1].slots).toBe(instance.slots)
    expect(args[1].emit).toBe(instance.emit)
  })

  it("fallthrough attrs are cloned onto the root vnode", () => {
    const Component = {
      render() {
        return createVNode("div")
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    instance.attrs = { id: "root-id" }

    const root = renderComponentRoot(instance)
    expect(root.props!.id).toBe("root-id")
  })

  it("catches render errors and returns a Comment vnode", () => {
    const Component = {
      render() {
        throw new Error("boom")
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    const root = renderComponentRoot(instance)
    expect(root.type).toBe(Comment)
  })
})

describe("emit", () => {
  it("instance.emit('event', ...args) invokes the matching onEvent prop", () => {
    let received: any[] = []
    const vnode = createVNode({}, { onFoo: (...args: any[]) => (received = args) }) as any
    const instance = createComponentInstance(vnode, null)
    instance.emit("foo", 1, 2)
    expect(received).toEqual([1, 2])
  })

  it("camelCase and kebab-case listener keys both resolve", () => {
    const seen: string[] = []
    const vnode = createVNode(
      {},
      {
        onFooBar: () => seen.push("camel"),
        onFoo: () => seen.push("plain"),
      }
    ) as any
    const instance = createComponentInstance(vnode, null)
    instance.emit("foo-bar")
    instance.emit("foo")
    expect(seen).toEqual(["camel", "plain"])
  })
})

describe("getExposeProxy", () => {
  it("returns a proxy exposing only instance.exposed keys plus public properties", () => {
    const vnode = createVNode({}) as any
    const instance = createComponentInstance(vnode, null)
    instance.exposed = { count: ref(0), secret: "hidden" }
    const proxy = getExposeProxy(instance)!

    expect(proxy.count).toBe(0)
    expect(proxy.secret).toBe("hidden")
    // public property fallback
    expect(proxy.$el).toBe(instance.vnode.el)
  })

  it("setupContext.expose(obj) sets instance.exposed", () => {
    let expose: any
    const Component = {
      setup(_props: any, ctx: any) {
        expose = ctx.expose
        return {}
      },
    }
    const instance = createComponentInstance(createVNode(Component) as any, null)
    setupComponent(instance)
    expose({ foo: 1 })
    expect(instance.exposed).toEqual({ foo: 1 })
  })
})

describe("getComponentName", () => {
  it("object component -> Component.name; functional -> Component.display || Component.name", () => {
    const named = { name: "MyComp" }
    expect(getComponentName(named as any)).toBe("MyComp")

    function Fn() {}
    Fn.display = "DisplayName"
    expect(getComponentName(Fn as any)).toBe("DisplayName")

    const plain = function PlainFn() {}
    expect(getComponentName(plain as any)).toBe("PlainFn")
  })
})
