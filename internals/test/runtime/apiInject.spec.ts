import { provide, inject } from "@soppy-vue/runtime-core"
import type { ComponentInternalInstance } from "@soppy-vue/runtime-core"
import type { hasInjectionContext as _hasInjectionContext } from "@soppy-vue/runtime-core/apiInject"
import type { createComponentInstance as _createComponentInstance } from "@soppy-vue/runtime-core/component"
import type { createVNode as _createVNode } from "@soppy-vue/runtime-core/vnode"
import type {
  setCurrentInstance as _setCurrentInstance,
  unsetCurrentInstance as _unsetCurrentInstance,
} from "@soppy-vue/runtime-core/component/context"

const API_INJECT_MODULE = "@soppy-vue/runtime-core/apiInject"
const COMPONENT_MODULE = "@soppy-vue/runtime-core/component"
const VNODE_MODULE = "@soppy-vue/runtime-core/vnode"
const CONTEXT_MODULE = "@soppy-vue/runtime-core/component/context"

async function loadCreateComponentInstance() {
  const mod = await import(COMPONENT_MODULE)
  return mod.createComponentInstance as typeof _createComponentInstance
}
async function loadSetCurrentInstance() {
  const mod = await import(CONTEXT_MODULE)
  return mod.setCurrentInstance as typeof _setCurrentInstance
}
async function loadUnsetCurrentInstance() {
  const mod = await import(CONTEXT_MODULE)
  return mod.unsetCurrentInstance as typeof _unsetCurrentInstance
}

describe("provide / inject (outside a component)", () => {
  it("provide outside a component instance is a no-op", () => {
    expect(() => provide("key", "value")).not.toThrow()
    expect(inject("key")).toBeUndefined()
  })

  it("inject outside a component returns undefined even with a default", () => {
    expect(inject("key", "default")).toBeUndefined()
  })
})

let hasInjectionContext: typeof _hasInjectionContext
let createVNode: typeof _createVNode

describe.runIf(__DEV__)("provide / inject (with an instance)", () => {
  beforeAll(async () => {
    ;({ hasInjectionContext } = await import(API_INJECT_MODULE))
    ;({ createVNode } = await import(VNODE_MODULE))
  })

  async function makeInstance(parent: ComponentInternalInstance | null = null) {
    const createComponentInstance = await loadCreateComponentInstance()
    return createComponentInstance(createVNode({}) as any, parent)
  }

  async function withInstance<T>(
    instance: ComponentInternalInstance | null,
    fn: () => T
  ): Promise<T> {
    const setCurrentInstance = await loadSetCurrentInstance()
    const unsetCurrentInstance = await loadUnsetCurrentInstance()
    if (instance) setCurrentInstance(instance)
    try {
      return fn()
    } finally {
      unsetCurrentInstance()
    }
  }

  describe("prototype-chain inheritance", () => {
    it("parent provides are visible to child", async () => {
      const parent = await makeInstance()
      const child = await makeInstance(parent)

      await withInstance(parent, () => provide("foo", "parent"))
      expect(await withInstance(child, () => inject("foo"))).toBe("parent")
    })

    it("child provide with same key shadows parent via a fresh prototype object", async () => {
      const parent = await makeInstance()
      const child = await makeInstance(parent)

      await withInstance(parent, () => provide("foo", "parent"))

      // child.provides starts as the SAME reference as parent.provides
      expect(child.provides).toBe(parent.provides)

      await withInstance(child, () => provide("foo", "child"))

      // first provide detaches the child's provides via Object.create(parentProvides)
      expect(child.provides).not.toBe(parent.provides)
      expect(Object.getPrototypeOf(child.provides)).toBe(parent.provides)

      // a grandchild injects the shadowed value (own property wins over the proto chain)
      const grandchild = await makeInstance(child)
      expect(await withInstance(grandchild, () => inject("foo"))).toBe("child")
    })

    it("sibling components do not leak provides to each other", async () => {
      const parent = await makeInstance()
      const a = await makeInstance(parent)
      const b = await makeInstance(parent)

      await withInstance(parent, () => provide("foo", "parent"))
      await withInstance(a, () => provide("bar", "from-a"))

      // b reads its parent's provides only, never a sibling's
      expect(await withInstance(b, () => inject("bar"))).toBeUndefined()
      expect(await withInstance(b, () => inject("foo"))).toBe("parent")
    })
  })

  describe("default value", () => {
    it("inject(key, defaultValue) returns the default when not provided", async () => {
      const instance = await makeInstance()
      expect(await withInstance(instance, () => inject("missing", "fallback"))).toBe("fallback")
    })

    it("inject(key, factoryFn) calls the factory and returns its result", async () => {
      const instance = await makeInstance()
      let calls = 0
      const value = await withInstance(instance, () =>
        inject("missing", () => {
          calls++
          return "computed"
        })
      )
      expect(calls).toBe(1)
      expect(value).toBe("computed")
    })

    it("factory is NOT called when the key is provided", async () => {
      const parent = await makeInstance()
      const child = await makeInstance(parent)
      await withInstance(parent, () => provide("foo", "present"))

      let calls = 0
      const value = await withInstance(child, () =>
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
    it("symbol-keyed provide/inject round-trips", async () => {
      const KEY = Symbol("key")
      const parent = await makeInstance()
      const child = await makeInstance(parent)

      await withInstance(parent, () => provide(KEY, "symbol-value"))
      expect(await withInstance(child, () => inject(KEY))).toBe("symbol-value")
    })
  })

  describe("hasInjectionContext", () => {
    it("returns false outside an instance and true inside one", async () => {
      expect(hasInjectionContext()).toBe(false)
      const instance = await makeInstance()
      let inside = false
      await withInstance(instance, () => {
        inside = hasInjectionContext()
      })
      expect(inside).toBe(true)
    })
  })
})
