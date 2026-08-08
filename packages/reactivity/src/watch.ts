import { isArray, isFunction, isObject, NOOP } from "@soppy-vue/shared"
import { isRef } from "./ref"
import type { EffectFunction } from "./effect"
import { ReactiveEffect } from "./effect"
import { isReactive } from "./reactive"

/**
 * executed in the effect inside watch, collect deps using custom options
 * since it only trigger `track` method of reactive proxy, detailed type annotations are not required.
 */
function traverse(value: unknown, depth: number = Infinity, seen?: Map<unknown, number>): unknown {
  if (!isObject(value)) {
    return value
  }

  seen = seen || new Map()
  // traverse to left node, or meet seen node
  if ((seen.get(value) || 0) >= depth) {
    return value
  }

  // depth: remaining traversal depth
  seen.set(value, depth)
  depth--

  if (isRef(value)) {
    // value.value trigger `trackRefValue`
    traverse(value.value, depth, seen)
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen)
    }
  } else if (isObject(value)) {
    /**
     * - the implementation here is subset of vue, in reality, there are more scenarios
     * - `for...in` only access string key, use `Object.getOwnPropertySymbols` get symbol key
     */
    for (const key in value) {
      traverse(value[key], depth, seen)
    }
    for (const symbolKey of Object.getOwnPropertySymbols(value)) {
      traverse(value[symbolKey], depth, seen)
    }
  }
  return value
}

type OnCleanup = (cleanupFn: () => void) => void

type WatchCallback<V = any, OV = any> = (val: V, oldVal: OV, onCleanup?: OnCleanup) => any

interface WatchOptions {
  deep?: boolean | number
  immediate?: boolean
}

function doWatch(source: object, cb: WatchCallback | null, options?: WatchOptions) {
  const { deep = true, immediate = true } = options ?? {}

  let getter: EffectFunction

  const reactiveGetter = (source: object) => {
    if (deep) {
      return traverse(source, deep === true ? Infinity : deep)
    } else {
      if (deep === false || deep === 0) return traverse(source, 1)
      return traverse(source)
    }
  }

  if (isRef(source)) {
    getter = () => source.value
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source)
  } else if (isFunction(source)) {
    getter = source
  } else {
    getter = NOOP
  }

  let cleanup: (() => void) | null
  const onCleanup = (fn: () => void) => {
    cleanup = () => {
      fn()
      cleanup = null
    }
  }

  let oldValue: any
  const job = () => {
    if (cb) {
      const newValue = effect.run()
      if (cleanup) {
        cleanup()
      }
      cb(newValue, oldValue, onCleanup)
      oldValue = newValue
    } else {
      effect.run()
    }
  }

  const effect = new ReactiveEffect(getter, job)

  if (cb) {
    if (immediate) {
      job()
    } else {
      oldValue = effect.run()
    }
  } else {
    effect.run()
  }
}

function watch(source: object, cb: WatchCallback, options?: WatchOptions) {
  return doWatch(source, cb, options)
}

function watchEffect(source: object, options?: WatchOptions) {
  return doWatch(source, null, options)
}

export { watch, watchEffect }
