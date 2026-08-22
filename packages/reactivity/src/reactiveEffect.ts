import { isArray, isSymbol } from "@soppy-vue/shared"
import type { Dep } from "./dep"
import { createDep } from "./dep"
import {
  activeEffect,
  pauseScheduling,
  resetScheduling,
  shouldTrack,
  trackEffect,
  triggerEffects,
} from "./effect"

const trackMap = new WeakMap<object, Map<PropertyKey, Dep | undefined>>()

function track(target: object, key: PropertyKey) {
  if (!activeEffect || !shouldTrack) return

  // get depsMap for specific target(equivalent to reactiveObj)
  let depsMap = trackMap.get(target)
  if (!depsMap) {
    trackMap.set(target, (depsMap = new Map()))
  }

  // get dep for reactiveObj.key
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(
      key,
      (dep = createDep(() => {
        depsMap.delete(key)
      }, key))
    )
  }

  trackEffect(activeEffect, dep, __DEV__ ? { target, key } : undefined)
}

function trigger(
  target: object,
  key: PropertyKey,
  newVal?: unknown,
  // only for trigger debugging
  oldVal?: unknown
) {
  const depsMap = trackMap.get(target)
  if (!depsMap) return

  /**
   * in official vue3, it implements special handling for CURD on Map/Array;
   * out impl only takes into account scenario when array.length is triggered
   */
  const deps: Array<Dep | undefined> = []

  if (key === "length" && isArray(target)) {
    const newLength = Number(newVal)
    depsMap.forEach((dep, key) => {
      /**
       * add length dep, and index large than newLength dep which is changed
       * relative to baseHandler/arrayInstrumentations
       * @example
       * ```ts
       * depsMap = {
       *   "0": dep0,
       *   "1": dep1,
       *   length: lengthDep,
       * }
       * // length = 1
       * // deps = [dep1, lengthDep]
       * // `key >= newLength` indicates those values are spliced (deleted)
       * ```
       */
      if (key === "length" || (!isSymbol(key) && Number(key) >= newLength)) {
        deps.push(dep)
      }
    })
  } else {
    if (key !== undefined) {
      deps.push(depsMap.get(key))
    }
  }

  // light: enclose triggerEffects in a pause/reset block, ensure schedule only once
  pauseScheduling()
  for (const dep of deps) {
    dep && triggerEffects(dep, __DEV__ ? { target, key, newVal, oldVal } : undefined)
  }
  resetScheduling()
}

export { track, trigger }
