/**
 * light: use bitwise operations to avoid comparing string directly in hot paths.
 * - `createVNode` is a core virtual DOM creation module, and can benefit from this optimization.
 * - Similar branch-based optimizations were introduced in other hot paths in later Vue versions.
 *
 * @example
 * // declare self and child type
 * ShapeFlags.ELEMENT | ShapeFlags.STATEFUL_COMPONENT
 * // check type consistency
 * shapeFlag & ShapeFlags.ELEMENT
 */
enum ShapeFlags {
  // common flag
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  // child state flag
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  SLOTS_CHILDREN = 1 << 5,
  // special flag
  TELEPORT = 1 << 6,
  SUSPENSE = 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
  COMPONENT_KEPT_ALIVE = 1 << 9,
  // component flag
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT,
}

enum PatchFlags {
  TEXT = 1,
  CLASS = 1 << 1,
  STYLE = 1 << 2,
  PROPS = 1 << 3,
  FULL_PROPS = 1 << 4,
  NEED_HYDRATION = 1 << 5,
  STABLE_FRAGMENT = 1 << 6,
  KEYED_FRAGMENT = 1 << 7,
  UNKEYED_FRAGMENT = 1 << 8,
  NEED_PATCH = 1 << 9,
  DYNAMIC_SLOTS = 1 << 10,
  DEV_ROOT_FRAGMENT = 1 << 11,
  HOISTED = -1,
  BAIL = -2,
  // self-design: used to optimize process of fragment-patching
  FRAGMENT = PatchFlags.KEYED_FRAGMENT | PatchFlags.UNKEYED_FRAGMENT,
}

export { ShapeFlags, PatchFlags }
