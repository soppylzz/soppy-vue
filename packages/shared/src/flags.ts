/**
 * light: use bitwise operations to avoid comparing string directly in hot paths.
 * - `createVNode` is a core virtual DOM creation module, and can benefit from this optimization.
 * - Similar branch-based optimizations were introduced in other hot paths in later Vue versions.
 *
 * @example
 * declare self and child type:
 * ```ts
 * ShapeFlags.ELEMENT | ShapeFlags.TEXT_CHILDREN
 * ```
 * check type consistency:
 * ```ts
 * shapeFlag & ShapeFlags.ELEMENT
 * ```
 */
enum ShapeFlags {
  // common flag
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
  // child state flag
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  // special flag
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 6,
  COMPONENT_KEPT_ALIVE = 1 << 7,
  TELEPORT = 1 << 8,
}

enum PatchFlags {
  /* =============== special flags =============== */
  /**
   * disable compiler optimization and force full
   * recursive diff.
   */
  BAIL = -2,
  /**
   * fully static node, vnode hoisted outside render().
   * skipped entirely during diff.
   */
  HOISTED = -1,

  /* =============== element flags =============== */
  TEXT = 1,
  CLASS = 1 << 1,
  STYLE = 1 << 2,

  /* =============== children flags =============== */
  KEYED_FRAGMENT = 1 << 3,
  UNKEYED_FRAGMENT = 1 << 4,
  STABLE_FRAGMENT = 1 << 5,

  /* =============== component flags =============== */
  FULL_PROPS = 1 << 6,
  // PROPS = 1 << 7,
  // DYNAMIC_SLOTS = 1 << 8,

  /* =============== reserved flags =============== */
  // NEED_PATCH = 1 << 9,
  // NEED_HYDRATION = 1 << 10,
  // DEV_ROOT_FRAGMENT = 1 << 11,
}

export { ShapeFlags, PatchFlags }
