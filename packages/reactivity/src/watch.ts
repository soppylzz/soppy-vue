import type { MaybeArray } from "@soppy-vue/shared"
import { EMPTY_OBJ, hasChanged, isArray, isFunction, isObject, NOOP } from "@soppy-vue/shared"
import type { Ref } from "./ref"
import { isRef } from "./ref"
import type { EffectFunction } from "./effect"
import { ReactiveEffect, resetTracking, toggleTracking } from "./effect"
import { isReactive, isShallow } from "./reactive"
import type { ComputedRef } from "./computed"

/* ==================== api types ==================== */
type OnCleanup = (cleanupFn: () => void) => void
type WatchEffect = (OnCleanup: OnCleanup) => void

type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

type WatchScheduler = { (job: () => void): void }
/**
 * note: ignore debugger hooks in `watch`/`computed` impl;
 * only impl them in `ref`/`reactive`
 */
interface BaseWatchOptions {
  deep?: boolean | number
  scheduler?: WatchScheduler
  augmentJob?: (job: (...args: any[]) => void) => void
}

type WatchCallback<V = any, OV = any> = (val: V, oldVal: OV, onCleanup: OnCleanup) => any

// not-impl-yet
type WatchHandler = {
  (): void
  stop: () => void
  // not-impl: because our effect does not impl pause, resume
  // pause: () => void
  // resume: () => void
}

// self design
type WatchTarget<T = any> = MaybeArray<WatchSource<T>> | WatchEffect | object

export type {
  WatchSource,
  BaseWatchOptions,
  WatchEffect,
  WatchHandler,
  WatchCallback,
  OnCleanup,
  WatchTarget,
}

/* ==================== base watch ==================== */
const cleanupMap: WeakMap<ReactiveEffect, (() => void)[]> = new WeakMap()

/**
 * note: vue@3.5 introduced `onWatcherCleanup` API, it maintains a `activeWatcher`
 * to find bind owner automatically, out impl does not expose it, so the simplified
 * code is as follows:
 */
function onWatcherCleanup(fn: () => void, owner: ReactiveEffect) {
  let cleanups = cleanupMap.get(owner)
  if (!cleanups) {
    cleanupMap.set(owner, (cleanups = []))
  }
  cleanups.push(fn)
}

function baseWatch(
  source: WatchTarget,
  cb?: WatchCallback | null,
  options: BaseWatchOptions = EMPTY_OBJ
) {
  const { deep, scheduler, augmentJob } = options

  const reactiveGetter = (source: object) => {
    /**
     * light: move the deep traverse logic to after the getter is built,
     * ensuring it takes effect on almost all watch source
     */
    if (deep) return source
    if (isShallow(source) || deep === false || deep === 0) return traverse(source, 1)
    return traverse(source)
  }

  let getter: EffectFunction

  let isMultiSource = false
  let forceTrigger = false

  /* =============== build getter =============== */
  if (isRef(source)) {
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source)
    forceTrigger = true
  } else if (isArray(source)) {
    isMultiSource = true
    forceTrigger = source.some((s) => isReactive(s) || isShallow(s))
    getter = () => {
      return source.map((s) => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          return reactiveGetter(s)
        } else if (isFunction(s)) {
          return s()
        }
        // not-impl: dev warn here
      })
    }
  } else if (isFunction(source)) {
    if (cb) {
      getter = source as EffectFunction
    } else {
      // handle watchEffect cb
      getter = () => {
        if (cleanup) {
          toggleTracking(false)
          try {
            cleanup()
          } finally {
            resetTracking()
          }
        }
        // produce: cleanup for `watchEffect`
        return source(onCleanup)
      }
    }
  } else {
    getter = NOOP
    // not-impl: dev warn here
  }

  /* =============== unified traverse & build effect =============== */
  if (cb && deep) {
    // should skip when traverse watchEffect
    const baseGetter = getter
    getter = () => traverse(baseGetter(), deep === true ? Infinity : deep)
  }
  const effect = new ReactiveEffect(getter)

  /* =============== build scheduler =============== */
  const onCleanup: OnCleanup = (fn) => onWatcherCleanup(fn, effect)
  const cleanup = (effect.onStop = () => {
    // consume: oncleanup
    const cleanups = cleanupMap.get(effect)
    if (cleanups) {
      for (const cleanup of cleanups) cleanup()
    }
    // light: every call of `cb` will re-add cleanupFn into `cleanupMap`
    cleanupMap.delete(effect)
  })

  let oldVal: any
  const job = () => {
    if (!effect.dirty) return

    if (cb) {
      // watch(source, cb)
      const newVal = effect.run()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newVal as any[]).some((v, i) => hasChanged(v, oldVal[i]))
          : hasChanged(newVal, oldVal))
      ) {
        // origin comment: cleanup before running cb again
        cleanup?.()

        // produce: cleanup for `watch`
        cb(newVal, oldVal, onCleanup)
        oldVal = newVal
      }
    } else {
      // watchEffect(fn)
      effect.run()
    }
  }

  // light: casting job at initial
  if (augmentJob) {
    augmentJob(job)
  }

  effect.scheduler = scheduler ? () => scheduler(job) : job

  /* =============== initial run =============== */
  if (cb) {
    oldVal = effect.run()
  } else if (scheduler) {
    scheduler(job.bind(null))
  } else {
    effect.run()
  }

  /* =============== return handler =============== */
  const watchHandler = (() => {
    effect.stop()
    // handle effect scope here, which we ignored
  }) as WatchHandler
  // default call as handle stop
  watchHandler.stop = watchHandler

  // watchHandler.pause = effect.pause.bind(effect)
  // watchHandler.resume = effect.resume.bind(effect)

  return watchHandler
}

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
      if (Object.prototype.propertyIsEnumerable.call(value, symbolKey)) {
        traverse(value[symbolKey as any], depth, seen)
      }
    }
  }
  return value
}

export { baseWatch }
