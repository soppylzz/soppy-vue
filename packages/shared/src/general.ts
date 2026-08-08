import type { NonNullObject } from "./types"

const isObject = (val: unknown): val is NonNullObject => val !== null && typeof val === "object"

const isFunction = (val: unknown): val is (...args: any[]) => any => typeof val === "function"

const isArray = <T>(val: T | T[]): val is T[] => Array.isArray(val)

const NOOP = () => {}

export { isObject, isFunction, isArray, NOOP }
