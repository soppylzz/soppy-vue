enum LifecycleHooks {
  /**
   * ingored hooks in our impl (compat vue2):
   * - BEFORE_CREATE,
   * - CREATED,
   */
  BEFORE_MOUNT = "beforeMount",
  MOUNTED = "mounted",
  BEFORE_UPDATE = "beforeUpdate",
  UPDATED = "updated",
  BEFORE_UNMOUNT = "beforeUnmount",
  UNMOUNTED = "unmounted",

  // for debugging component track/trigger
  RENDER_TRACKED = "renderTracked",
  RENDER_TRIGGERED = "renderTriggered",
}

/* ==================== self design ==================== */
enum VNodeInternals {
  IS_VNODE = "__sv_isVNode",
}

/**
 * use semantic variables to represent
 * internals, more developer-friendly
 *
 * not-impl-yet:
 * - IS_COMPILED
 * - DISABLE_TRACK
 * - IS_SCOPED (compat for vue2)
 */
enum SlotInternals {
  IS_NORM = "__sv_isNormalized",
}

export { LifecycleHooks, VNodeInternals, SlotInternals }
