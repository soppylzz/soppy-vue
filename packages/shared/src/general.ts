import type { NonNullObject } from "./types"

/* ==================== type guards (common) ==================== */
const isArray = <T>(val: T | T[]): val is T[] => Array.isArray(val)
const isString = (val: unknown): val is string => typeof val === "string"
const isObject = (val: unknown): val is NonNullObject => val !== null && typeof val === "object"
const isFunction = (val: unknown): val is (...args: any[]) => any => typeof val === "function"

export { isObject, isFunction, isArray, isString }

/* ==================== type guards (built-in) ==================== */
const isOn = (key: string): key is `on${string}` => /^on[A-Z]/.test(key)

export { isOn }

/* ==================== common utils ==================== */
const NOOP = () => {}
const extend = Object.assign
const ensureArray = <T>(val: T | T[]): T[] => (isArray(val) ? val : [val])

/**
 * vue enables `Object.freeze(*)` only in DEV mode to prevent
 * accidental modification to `EMPTY_OBJ`, `EMPTY_ARR`
 */
const EMPTY_OBJ: { readonly [p: string]: any } = Object.freeze({})
const EMPTY_ARR = Object.freeze([])

export { NOOP, extend, ensureArray, EMPTY_OBJ, EMPTY_ARR }

/* ==================== string utils ==================== */
const camelizeRE = /-(\w)/g
const hyphenateRE = /\B([A-Z])/g

const camelize = (str: string): string =>
  str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ""))

const hyphenate = (str: string) => str.replace(hyphenateRE, "-$1").toLowerCase()
const capitalize = <T extends string>(str: T) =>
  (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>

export { camelize, hyphenate, capitalize }
