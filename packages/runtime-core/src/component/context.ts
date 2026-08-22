/**
 * @module component-context
 * centralizes access to the `CurrentInternalInstance` used throughout the vue runtime,
 * previouslu split into `currentInstance` and `currentRenderingInstance`, these are now
 * unified here
 */
import { SlotInternals } from "../constant"
import type { ComponentInternalInstance } from "./component"
import type { SlotTarget } from "./slots"

/* ==================== instance (internal) ==================== */
let currentInstance: ComponentInternalInstance | null = null

const setCurrentInstance = (instance: ComponentInternalInstance) => {
  currentInstance = instance
  /**
   * in official vue3, it handles `instance.scope` here, to ensure the
   * watchers used within `setup` align with the component lifecycle,
   * our impl ignores this.
   */
  // instance.scope.on()
}

const unsetCurrentInstance = () => {
  // currentInstance && currentInstance.scope.off()
  currentInstance = null
}

/* ==================== rendering instance (internal) ==================== */
let currentRenderingInstance: ComponentInternalInstance | null = null

function setCurrentRenderingInstance(
  instance: ComponentInternalInstance | null
): ComponentInternalInstance | null {
  const prev = currentRenderingInstance
  currentRenderingInstance = instance
  return prev
}

/**
 * wraps a slotFn so that it executes under the correct component instance context
 */
function withCtx(
  fn: Function & SlotTarget,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn
  if (fn[SlotInternals.IS_NORM]) return fn

  const renderFnWithContext: Function & SlotTarget = (...args: any[]) => {
    /**
     * --- why set currentRenderingInstance? ---
     *
     * currentInstance is set during `setupStatefulComponent()` and cleared
     * immediately after `setup()` returns. by the time the template is compiled
     * and slots are processed, currentInstance is already null.
     */
    const prevInstance = setCurrentRenderingInstance(ctx)
    let res
    try {
      res = fn(...args)
    } finally {
      setCurrentRenderingInstance(prevInstance)
    }
    return res
  }

  renderFnWithContext[SlotInternals.IS_NORM] = true

  return renderFnWithContext
}

/* ==================== exposed ==================== */
const getCurrentInstance: () => ComponentInternalInstance | null = () =>
  currentInstance || currentRenderingInstance

export {
  withCtx,
  currentInstance,
  getCurrentInstance,
  setCurrentInstance,
  currentRenderingInstance,
  unsetCurrentInstance,
  setCurrentRenderingInstance,
}
