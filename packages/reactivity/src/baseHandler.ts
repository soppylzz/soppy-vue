import type { NonNullObject } from "@soppy-vue/shared"
import { isObject } from "@soppy-vue/shared"
import { ReactiveFlags } from "./constants"
import { reactive } from "./reactive"
import { track, trigger } from "./reactiveEffect"

const mutableHandler: ProxyHandler<NonNullObject> = {
  get(target, key, receiver) {
    // light: non-invasive reactiveObj recognition
    if (key === ReactiveFlags.IS_REACTIVE) return true

    // STEP: 2. dependencies collection
    track(target, key)

    // light: lazy reactive for deep reactiveObj
    const value = Reflect.get(target, key, receiver)
    return isObject(value) ? reactive(value) : value
  },
  set(target, key, newVal, receiver) {
    const oldVal = target[key]

    const result = Reflect.set(target, key, newVal, receiver)

    if (oldVal !== newVal) {
      // STEP: 5. change dispatching
      trigger(target, key)
    }
    return result
  },
}

export { mutableHandler }
