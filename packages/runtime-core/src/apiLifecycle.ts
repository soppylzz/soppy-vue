import type { DebuggerEvent } from "@soppy-vue/reactivity"
import { resetTracking, setTracking } from "@soppy-vue/reactivity"
import type { ComponentInternalInstance } from "./component"
import { currentInstance, setCurrentInstance, unsetCurrentInstance } from "./component"
import { LifecycleHooks } from "./constant"

function injectHook(
  type: LifecycleHooks,
  hook: Function & { __hook?: Function },
  target: ComponentInternalInstance | null = currentInstance,
  prepend: boolean = false
) {
  if (target) {
    // light: inject hooks into ComponentInternalInstance here
    const hooks = target[type] || (target[type] = [])

    const wrappedHook =
      hook.__hook ||
      (hook.__hook = (...args: unknown[]) => {
        if (target.isUnmounted) return

        setTracking(false)
        setCurrentInstance(target)
        const res = hook(...args)
        unsetCurrentInstance()
        resetTracking()
        return res
      })

    // prepend: specify whether hookFn is enqueued at the front of the queue
    if (prepend) {
      hooks.unshift(wrappedHook)
    } else {
      hooks.push(wrappedHook)
    }
    return wrappedHook
  }
  // developer-friendly checks here
}

const createHook = <T extends Function = () => any>(lifecycle: LifecycleHooks) => {
  return (hook: T, target: ComponentInternalInstance | null = currentInstance) => {
    /**
     * light: handle ssr here, post-create lifecycle registrations
     * are noops during SSR (except for serverPrefetch), ingored in
     * our impl.
     */
    return injectHook(lifecycle, (...args: unknown[]) => hook(...args), target)
  }
}

/**
 * --- why are there no `onCreated` or `onBeforeCreate` hooks here? ---
 *
 * the setup() function itself runs at exactly the timing of
 * `beforeCreate` and `created` in vue2 therefore, any logic you
 * would have written inside those two hooks in Vue 2 can simply
 * be written directly inside `setup()`.
 */
const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
const onMounted = createHook(LifecycleHooks.MOUNTED)
const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
const onUpdated = createHook(LifecycleHooks.UPDATED)
const onBeforeUnmount = createHook(LifecycleHooks.BEFORE_UNMOUNT)
const onUnmounted = createHook(LifecycleHooks.BEFORE_UNMOUNT)

// debug hooks: the debug APIs we have selectively implemented
type DebuggerHook = (e: DebuggerEvent) => void
const onRenderTracked = createHook<DebuggerHook>(LifecycleHooks.RENDER_TRACKED)
const onRenderTriggered = createHook<DebuggerHook>(LifecycleHooks.RENDER_TRIGGERED)

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onRenderTracked,
  onRenderTriggered,
  // exposed for keepalive impl
  injectHook,
}
