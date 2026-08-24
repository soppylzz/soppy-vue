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

  // for keepalive impl
  DEACTIVATED = "deactivated",
  ACTIVATED = "activated",
}

/* ==================== self design ==================== */
enum RuntimeFlags {
  IS_VNODE = "__sv_isVNode",
  IS_KEEP_ALIVE = "__sv_isKeepAlive",
  IS_TELEPORT = "__sv_isTeleport",
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

enum MoveTypes {
  REORDER = 1,
  ENTER = 1 << 1,
  LEAVE = 1 << 2,
}

enum TeleportMoveTypes {
  /**
   * related to `to`, indicates target has been changed
   * @example
   * ```vue
   * <Teleport :to="condition ? '#a' : '#b'"><div/></Teleport>
   * ```
   */
  TARGET_CHANGE = 1,
  // Teleport's own location has changed
  REORDER = 1 << 1,
  /**
   * not-impl: TOGGLE
   * related to `disabled`, indicates whether teleport is enabled
   * @example
   * ```vue
   * <Teleport :disabled="isDisabled"><div/></Teleport>
   * ```
   */
}

export { MoveTypes, TeleportMoveTypes, LifecycleHooks, RuntimeFlags, SlotInternals }
