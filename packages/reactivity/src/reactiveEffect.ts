import type { Dep } from "./dep"
import { createDep } from "./dep"
import { activeEffect, trackEffect, triggerEffects } from "./effect"

const trackMap = new WeakMap<object, Map<PropertyKey, Dep | undefined>>()

function track(target: object, key: PropertyKey) {
  if (!activeEffect) return

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

  trackEffect(activeEffect, dep)
}

function trigger(target: object, key: PropertyKey) {
  const depsMap = trackMap.get(target)
  if (!depsMap) return

  const dep = depsMap.get(key)
  if (dep) {
    triggerEffects(dep)
  }
}

export { track, trigger }
