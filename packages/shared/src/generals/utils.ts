import { isArray, isString } from "./guards"
import { capitalize } from "./string"

/* ==================== common ==================== */
const NOOP = () => {}
const extend = Object.assign
const ensureArray = <T>(val: T | T[]): T[] => (isArray(val) ? val : [val])

/**
 * uncurried wrapper around `Object.prototype.hasOwnProperty`
 * - uncurried (this fn): `(obj, key) => boolean`
 * - curried: `obj => key => boolean`
 */
const hasOwn = (val: object, key: string | symbol): key is keyof typeof val =>
  Object.prototype.hasOwnProperty.call(val, key)

const getProto = (val: object): object | null => Object.getPrototypeOf(val)

// `MaybeArray` should be handled before calling this fn
const syncRunFns = (fns: Function[], ...args: any[]) => {
  fns.forEach((fn) => fn(...args))
}

// handle `+0 === -0` => false, `NaN === NaN` => false
const hasChanged = (val: any, oldVal: any): boolean => !Object.is(val, oldVal)

/**
 * vue enables `Object.freeze(*)` only in DEV mode to prevent
 * accidental modification to `EMPTY_OBJ`, `EMPTY_ARR`
 */
const EMPTY_OBJ: { readonly [p: string]: any } = Object.freeze({})
const EMPTY_ARR = Object.freeze([])

export { NOOP, extend, hasOwn, getProto, ensureArray, syncRunFns, hasChanged, EMPTY_OBJ, EMPTY_ARR }

/* ==================== built-in ==================== */
const toHandlerKey = <T extends string>(str: T) => {
  const s = str ? `on${capitalize(str)}` : ""
  return s as T extends "" ? "" : `on${Capitalize<T>}`
}

const toNumber = (val: any): any => {
  const num = isString(val) ? Number(val) : NaN
  return isNaN(num) ? val : num
}

export { toHandlerKey, toNumber }
