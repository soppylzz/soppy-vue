import type { NonNullObject } from "./types"

const isObject = (val: unknown): val is NonNullObject => val !== null && typeof val === "object"

const isFunction = (val: unknown): val is (...args: any[]) => any => typeof val === "function"

export { isObject, isFunction }
