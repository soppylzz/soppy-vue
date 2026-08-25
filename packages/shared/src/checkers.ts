function makeChecker(checks: string[], enableToLowerCase?: boolean): (val: string) => boolean {
  const set = new Set(checks)
  return enableToLowerCase ? (val) => set.has(val.toLowerCase()) : (val) => set.has(val)
}

const isReservedProp = makeChecker([
  "key", // for diff
  "ref", // for DOM ref
  // reserved for vnode debugging
  "onVNodeBeforeMount",
  // fix: typo of vnode hooks
  "onVNodeMounted",
  "onVNodeBeforeUpdate",
  "onVNodeUpdated",
  "onVNodeBeforeUnmount",
  "onVNodeUnmounted",
])

export { makeChecker, isReservedProp }
