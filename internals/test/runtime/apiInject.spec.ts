import { provide, inject } from "@soppy-vue/runtime-core"
import { hasInjectionContext } from "@soppy-vue/runtime-core/apiInject"
import { setCurrentInstance, unsetCurrentInstance } from "@soppy-vue/runtime-core/component/context"
import { createComponentInstance } from "@soppy-vue/runtime-core/component"
import { createVNode } from "@soppy-vue/runtime-core/vnode"
import type { ComponentInternalInstance } from "@soppy-vue/runtime-core"

function makeInstance(parent: ComponentInternalInstance | null = null) {
  return createComponentInstance(createVNode({}) as any, parent)
}

function withInstance<T>(instance: ComponentInternalInstance | null, fn: () => T): T {
  if (instance) setCurrentInstance(instance)
  try {
    return fn()
  } finally {
    unsetCurrentInstance()
  }
}

describe("provide / inject", () => {
  it("provide outside a component instance is a no-op", () => {
    expect(() => withInstance(null, () => provide("key", "value"))).not.toThrow()
    expect(withInstance(null, () => inject("key"))).toBeUndefined()
  })

  it("inject outside a component returns undefined even with a default", () => {
    expect(withInstance(null, () => inject("key", "default"))).toBeUndefined()
  })
})

describe("prototype-chain inheritance", () => {
  it("parent provides are visible to child", () => {
    const parent = makeInstance()
    const child = makeInstance(parent)

    withInstance(parent, () => provide("foo", "parent"))
    expect(withInstance(child, () => inject("foo"))).toBe("parent")
  })

  it("child provide with same key shadows parent via a fresh prototype object", () => {
    const parent = makeInstance()
    const child = makeInstance(parent)

    withInstance(parent, () => provide("foo", "parent"))

    // child.provides starts as the SAME reference as parent.provides
    expect(child.provides).toBe(parent.provides)

    withInstance(child, () => provide("foo", "child"))

    // first provide detaches the child's provides via Object.create(parentProvides)
    expect(child.provides).not.toBe(parent.provides)
    expect(Object.getPrototypeOf(child.provides)).toBe(parent.provides)

    // a grandchild injects the shadowed value (own property wins over the proto chain)
    const grandchild = makeInstance(child)
    expect(withInstance(grandchild, () => inject("foo"))).toBe("child")
  })

  it("sibling components do not leak provides to each other", () => {
    const parent = makeInstance()
    const a = makeInstance(parent)
    const b = makeInstance(parent)

    withInstance(parent, () => provide("foo", "parent"))
    withInstance(a, () => provide("bar", "from-a"))

    // b reads its parent's provides only, never a sibling's
    expect(withInstance(b, () => inject("bar"))).toBeUndefined()
    expect(withInstance(b, () => inject("foo"))).toBe("parent")
  })
})

describe("default value", () => {
  it("inject(key, defaultValue) returns the default when not provided", () => {
    const instance = makeInstance()
    expect(withInstance(instance, () => inject("missing", "fallback"))).toBe("fallback")
  })

  it("inject(key, factoryFn) calls the factory and returns its result", () => {
    const instance = makeInstance()
    let calls = 0
    const value = withInstance(instance, () =>
      inject("missing", () => {
        calls++
        return "computed"
      })
    )
    expect(calls).toBe(1)
    expect(value).toBe("computed")
  })

  it("factory is NOT called when the key is provided", () => {
    const parent = makeInstance()
    const child = makeInstance(parent)
    withInstance(parent, () => provide("foo", "present"))

    let calls = 0
    const value = withInstance(child, () =>
      inject("foo", () => {
        calls++
        return "default"
      })
    )
    expect(calls).toBe(0)
    expect(value).toBe("present")
  })
})

describe("InjectionKey", () => {
  it("symbol-keyed provide/inject round-trips", () => {
    const KEY = Symbol("key")
    const parent = makeInstance()
    const child = makeInstance(parent)

    withInstance(parent, () => provide(KEY, "symbol-value"))
    expect(withInstance(child, () => inject(KEY))).toBe("symbol-value")
  })
})

describe("hasInjectionContext", () => {
  it("returns false outside an instance and true inside one", () => {
    expect(hasInjectionContext()).toBe(false)
    const instance = makeInstance()
    let inside = false
    withInstance(instance, () => {
      inside = hasInjectionContext()
    })
    expect(inside).toBe(true)
  })
})
