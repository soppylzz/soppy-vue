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
import { injectHook } from "@soppy-vue/runtime-core/apiLifecycle"
import { LifecycleHooks } from "@soppy-vue/runtime-core/constant"
import { setCurrentInstance, unsetCurrentInstance } from "@soppy-vue/runtime-core/component/context"
import { createComponentInstance } from "@soppy-vue/runtime-core/component"
import { createVNode } from "@soppy-vue/runtime-core/vnode"
import { shouldTrack } from "@soppy-vue/reactivity"
import type { ComponentInternalInstance } from "@soppy-vue/runtime-core"

function makeInstance(): ComponentInternalInstance {
  return createComponentInstance(createVNode({}) as any, null)
}

function withInstance<T>(instance: ComponentInternalInstance | null, fn: () => T): T {
  if (instance) setCurrentInstance(instance)
  try {
    return fn()
  } finally {
    unsetCurrentInstance()
  }
}

describe("hook registration", () => {
  it("onMounted(fn) outside a component is a no-op", () => {
    expect(onMounted(() => {})).toBeUndefined()
  })

  it("onMounted(fn) inside an active instance appends a wrapped hook to instance.mounted", () => {
    const instance = makeInstance()
    const fn = () => {}
    withInstance(instance, () => onMounted(fn))
    expect(instance.mounted).toHaveLength(1)
  })

  it("multiple onMounted calls append in order; injectHook prepend inserts at the front", () => {
    const instance = makeInstance()
    const order: string[] = []

    withInstance(instance, () => {
      onMounted(() => order.push("a"))
      injectHook(LifecycleHooks.MOUNTED, () => order.push("b"), instance, true)
    })

    expect(instance.mounted).toHaveLength(2)
    instance.mounted!.forEach((hook) => hook())
    expect(order).toEqual(["b", "a"])
  })
})

describe("injectHook wrapping", () => {
  it("wrapped hook sets currentInstance to the target during execution and unsets after", () => {
    const instance = makeInstance()
    let seenInside: ComponentInternalInstance | null = null

    withInstance(instance, () =>
      onMounted(() => {
        seenInside = getCurrentInstance()
      })
    )
    instance.mounted![0]()

    expect(seenInside).toBe(instance)
    expect(getCurrentInstance()).toBeNull()
  })

  it("wrapped hook disables tracking during execution", () => {
    const instance = makeInstance()
    let seenShouldTrack: boolean | null = null

    withInstance(instance, () =>
      onMounted(() => {
        seenShouldTrack = shouldTrack
      })
    )
    instance.mounted![0]()

    expect(seenShouldTrack).toBe(false)
    expect(shouldTrack).toBe(true)
  })

  it("wrapped hook is skipped if instance.isUnmounted is true", () => {
    const instance = makeInstance()
    let calls = 0
    withInstance(instance, () => onMounted(() => calls++))
    instance.isUnmounted = true
    instance.mounted![0]()
    expect(calls).toBe(0)
  })

  it("injectHook returns the wrapped hook, cached via hook.__hook across calls", () => {
    const instance = makeInstance()
    const fn = () => {}
    const first = withInstance(instance, () => injectHook(LifecycleHooks.MOUNTED, fn))
    const second = withInstance(instance, () => injectHook(LifecycleHooks.MOUNTED, fn))
    expect(first).toBe(second)
  })
})

describe("hook types", () => {
  it("each onX registers under its corresponding LifecycleHooks key", () => {
    const instance = makeInstance()
    withInstance(instance, () => {
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

describe.runIf(__DEV__)("debug hooks", () => {
  it("onRenderTracked / onRenderTriggered register under renderTracked / renderTriggered", () => {
    const instance = makeInstance()
    withInstance(instance, () => {
      onRenderTracked(() => {})
      onRenderTriggered(() => {})
    })

    expect(instance[LifecycleHooks.RENDER_TRACKED]).toHaveLength(1)
    expect(instance[LifecycleHooks.RENDER_TRIGGERED]).toHaveLength(1)
  })
})
