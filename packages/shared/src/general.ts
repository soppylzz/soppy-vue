import type { NonNullObject } from "./types"

const isObject = (val: unknown): val is NonNullObject => val !== null && typeof val === "object"

export { isObject }
