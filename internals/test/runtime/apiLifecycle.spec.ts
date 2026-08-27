import {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onRenderTracked,
  onRenderTriggered,
  getCurrentInstance,
} from "@soppy-vue/runtime-core"
import { shouldTrack } from "@soppy-vue/reactivity"
import type { ComponentInternalInstance } from "@soppy-vue/runtime-core"
import type { injectHook as _injectHook } from "@soppy-vue/runtime-core/apiLifecycle"
import type { LifecycleHooks as _LifecycleHooks } from "@soppy-vue/runtime-core/constant"
import type { createComponentInstance as _createComponentInstance } from "@soppy-vue/runtime-core/component"
import type { createVNode as _createVNode } from "@soppy-vue/runtime-core/vnode"
import type {
  setCurrentInstance as _setCurrentInstance,
  unsetCurrentInstance as _unsetCurrentInstance,
} from "@soppy-vue/runtime-core/component/context"

const LIFECYCLE_MODULE = "@soppy-vue/runtime-core/apiLifecycle"
const CONSTANT_MODULE = "@soppy-vue/runtime-core/constant"
const COMPONENT_MODULE = "@soppy-vue/runtime-core/component"
const VNODE_MODULE = "@soppy-vue/runtime-core/vnode"
const CONTEXT_MODULE = "@soppy-vue/runtime-core/component/context"

async function loadCreateComponentInstance() {
  const mod = await import(COMPONENT_MODULE)
  return mod.createComponentInstance as typeof _createComponentInstance
}
async function loadCreateVNode() {
  const mod = await import(VNODE_MODULE)
  return mod.createVNode as typeof _createVNode
}
async function loadSetCurrentInstance() {
  const mod = await import(CONTEXT_MODULE)
  return mod.setCurrentInstance as typeof _setCurrentInstance
}
async function loadUnsetCurrentInstance() {
  const mod = await import(CONTEXT_MODULE)
  return mod.unsetCurrentInstance as typeof _unsetCurrentInstance
}

// public API: registering a hook outside a component is a safe no-op
describe("hook registration (outside a component)", () => {
  it("onMounted(fn) outside a component is a no-op", () => {
    expect(onMounted(() => {})).toBeUndefined()
  })
})

let injectHook: typeof _injectHook
let LifecycleHooks: typeof _LifecycleHooks

describe.runIf(__DEV__)("hook registration (with an instance)", () => {
  beforeAll(async () => {
    ;({ injectHook } = await import(LIFECYCLE_MODULE))
    ;({ LifecycleHooks } = await import(CONSTANT_MODULE))
  })

  async function makeInstance(): Promise<ComponentInternalInstance> {
    const createComponentInstance = await loadCreateComponentInstance()
    const createVNode = await loadCreateVNode()
    return createComponentInstance(createVNode({}) as any, null)
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

  it("onMounted(fn) inside an active instance appends a wrapped hook to instance.mounted", async () => {
    const instance = await makeInstance()
    const fn = () => {}
    await withInstance(instance, () => onMounted(fn))
    expect(instance.mounted).toHaveLength(1)
  })

  it("multiple onMounted calls append in order; injectHook prepend inserts at the front", async () => {
    const instance = await makeInstance()
    const order: string[] = []

    await withInstance(instance, () => {
      onMounted(() => order.push("a"))
      injectHook(LifecycleHooks.MOUNTED, () => order.push("b"), instance, true)
    })

    expect(instance.mounted).toHaveLength(2)
    instance.mounted!.forEach((hook) => hook())
    expect(order).toEqual(["b", "a"])
  })

  describe("injectHook wrapping", () => {
    it("wrapped hook sets currentInstance to the target during execution and unsets after", async () => {
      const instance = await makeInstance()
      let seenInside: ComponentInternalInstance | null = null

      await withInstance(instance, () =>
        onMounted(() => {
          seenInside = getCurrentInstance()
        })
      )
      instance.mounted![0]()

      expect(seenInside).toBe(instance)
      expect(getCurrentInstance()).toBeNull()
    })

    it("wrapped hook disables tracking during execution", async () => {
      const instance = await makeInstance()
      let seenShouldTrack: boolean | null = null

      await withInstance(instance, () =>
        onMounted(() => {
          seenShouldTrack = shouldTrack
        })
      )
      instance.mounted![0]()

      expect(seenShouldTrack).toBe(false)
      expect(shouldTrack).toBe(true)
    })

    it("wrapped hook is skipped if instance.isUnmounted is true", async () => {
      const instance = await makeInstance()
      let calls = 0
      await withInstance(instance, () => onMounted(() => calls++))
      instance.isUnmounted = true
      instance.mounted![0]()
      expect(calls).toBe(0)
    })

    it("injectHook returns the wrapped hook, cached via hook.__hook across calls", async () => {
      const instance = await makeInstance()
      const fn = () => {}
      const first = await withInstance(instance, () => injectHook(LifecycleHooks.MOUNTED, fn))
      const second = await withInstance(instance, () => injectHook(LifecycleHooks.MOUNTED, fn))
      expect(first).toBe(second)
    })
  })

  describe("hook types", () => {
    it("each onX registers under its corresponding LifecycleHooks key", async () => {
      const instance = await makeInstance()
      await withInstance(instance, () => {
        onBeforeMount(() => {})
        onMounted(() => {})
        onBeforeUpdate(() => {})
        onUpdated(() => {})
        onBeforeUnmount(() => {})
        onUnmounted(() => {})
      })

      expect(instance.beforeMount).toHaveLength(1)
      expect(instance.mounted).toHaveLength(1)
      expect(instance.beforeUpdate).toHaveLength(1)
      expect(instance.updated).toHaveLength(1)
      expect(instance.beforeUnmount).toHaveLength(1)
      expect(instance.unmounted).toHaveLength(1)
    })
  })

  describe("debug hooks", () => {
    it("onRenderTracked / onRenderTriggered register under renderTracked / renderTriggered", async () => {
      const instance = await makeInstance()
      await withInstance(instance, () => {
        onRenderTracked(() => {})
        onRenderTriggered(() => {})
      })

      expect(instance[LifecycleHooks.RENDER_TRACKED]).toHaveLength(1)
      expect(instance[LifecycleHooks.RENDER_TRIGGERED]).toHaveLength(1)
    })
  })
})
