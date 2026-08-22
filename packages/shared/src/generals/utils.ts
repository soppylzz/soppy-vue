import { isArray } from "./guards"
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

const syncRunFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}

/**
 * vue enables `Object.freeze(*)` only in DEV mode to prevent
 * accidental modification to `EMPTY_OBJ`, `EMPTY_ARR`
 */
const EMPTY_OBJ: { readonly [p: string]: any } = Object.freeze({})
const EMPTY_ARR = Object.freeze([])

export { NOOP, extend, hasOwn, getProto, ensureArray, syncRunFns, EMPTY_OBJ, EMPTY_ARR }

/* ==================== built-in ==================== */
const toHandlerKey = <T extends string>(str: T) => {
  const s = str ? `on${capitalize(str)}` : ""
  return s as T extends "" ? "" : `on${Capitalize<T>}`
}

export { toHandlerKey }
