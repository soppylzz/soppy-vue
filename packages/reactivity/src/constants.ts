enum ReactiveFlags {
  IS_REACTIVE = "__sv_isReactive",
  IS_REF = "__sv_isRef",
  /**
   * those flags are not part of the mini-impl of reactivity;
   * rather, it were added due to runtime mini-impl
   */
  IS_SHALLOW = "__sv_isShallow",
  SKIP = "__sv_skip",
  RAW = "__sv_raw",
}

enum DirtyLevels {
  DIRTY = 4,
  NO_DIRTY = 0,
}

export { ReactiveFlags, DirtyLevels }
