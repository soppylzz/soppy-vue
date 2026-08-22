/* ==================== common ==================== */
const isArray = <T>(val: T | T[]): val is T[] => Array.isArray(val)
const isString = (val: unknown): val is string => typeof val === "string"
const isObject = (val: unknown): val is Record<any, any> => val !== null && typeof val === "object"
const isFunction = (val: unknown): val is (...args: any[]) => any => typeof val === "function"
const isSymbol = (val: unknown): val is symbol => typeof val === "symbol"

export { isObject, isFunction, isArray, isString, isSymbol }

/* ==================== internal ==================== */
const isOn = (key: string): key is `on${string}` => /^on[A-Z]/.test(key)
const isModelListener = (key: string) => key.startsWith("onUpdate:")
const isModelListenerPrunedOn = (key: string) => key.startsWith("update:")

// primarily used for array proxy
const isIntegerKey = (key: unknown) =>
  isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key

export { isOn, isModelListener, isModelListenerPrunedOn, isIntegerKey }
