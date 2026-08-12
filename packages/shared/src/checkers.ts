function makeChecker(checks: string[], enableToLowerCase?: boolean): (val: string) => boolean {
  const set = new Set(checks)
  return enableToLowerCase ? (val) => set.has(val.toLowerCase()) : (val) => set.has(val)
}

const isReservedProp = makeChecker(["key"])

export { makeChecker, isReservedProp }
