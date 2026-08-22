const camelizeRE = /-(\w)/g
const hyphenateRE = /\B([A-Z])/g

const camelize = (str: string): string =>
  str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ""))

const hyphenate = (str: string) => str.replace(hyphenateRE, "-$1").toLowerCase()
const capitalize = <T extends string>(str: T) =>
  (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>

export { camelize, hyphenate, capitalize }
