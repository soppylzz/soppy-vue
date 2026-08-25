import { getProto, hasOwn, isArray, isIntegerKey, isObject } from "@soppy-vue/shared"
import { ReactiveFlags } from "./constants"
import type { Target } from "./reactive"
import { isShallow, reactive, toRaw } from "./reactive"
import { track, trigger } from "./reactiveEffect"
import { isRef } from "./ref"

const arrayInstrumentations = (() => {
  const fnTrackMap: Record<string, Function> = {}

  // won't track those method name, but rather track [idx], length
  ;(["includes", "indexOf", "lastIndexOf"] as const).forEach((fn) => {
    fnTrackMap[fn] = function (this: unknown[], ...args: unknown[]) {
      // this function will execute with this = proxy
      const targetArr = toRaw(this) as any

      // light: track target.length implicitly
      const l = this.length
      for (let i = 0; i < l; i++) {
        track(targetArr, `${i}`)
      }
      // fix: if that didn't work, run it again using raw values.
      return targetArr[fn](...args.map(toRaw))
    }
  })

  // won't track those method name, but rather track length
  ;(["push", "pop", "shift", "unshift", "splice"] as const).forEach((fn) => {
    fnTrackMap[fn] = function (this: unknown[], ...args: unknown[]) {
      const targetArr = toRaw(this) as any
      track(targetArr, "length")
      return targetArr[fn](...args.map(toRaw))
    }
  })
  return fnTrackMap
})()

/**
 * constructor of mutableHandler, shallowHandler
 *
 * official vue3 uses an inheritance hierarchy:
 *   BaseReactiveHandler
 *     ├── MutableReactiveHandler
 *     └── ReadonlyReactiveHandler
 * our impl deliberately omits the readonly API to reduce complexity
 * since no readonly protection exists, use must not be modified by convention
 */
class MutableReactiveHandler implements ProxyHandler<Target> {
  public static reactiveMap = new WeakMap<Target, any>()
  public static shallowReactiveMap = new WeakMap<Target, any>()

  constructor(readonly shallow = false) {}
  get(target: Target, key: string | symbol, receiver: object) {
    const shallow = this.shallow

    /**
     * light: non-invasive special access:
     * - reactive, shallowReactive recognition
     * - target access
     * will not track
     */
    if (key === ReactiveFlags.IS_REACTIVE) return true
    if (key === ReactiveFlags.IS_SHALLOW) return shallow
    if (key === ReactiveFlags.RAW) {
      // case 1: normal access, receiver is vue-created proxy
      if (
        receiver ===
        (shallow ? MutableReactiveHandler.shallowReactiveMap : MutableReactiveHandler.reactiveMap)
      ) {
        return target
      }

      /**
       * case 2. user wrapped our reactive proxy
       * @example
       * ```ts
       * const userProxy = new Proxy(proxy, { get: (tgt, p, rcr) => Reflect.get(tgt, p, rcr) })
       * ```
       * in this scenario, recevier here is userProxy, which is NOT in built-in maps,
       * we rely on: `getProto(userProxy) === getProto(proxy) === getProto(target)`
       */
      if (getProto(receiver) === getProto(target)) {
        return target
      }

      /**
       * case 3. property was inherited via proto-chain
       * @example
       * ```ts
       * const user = Object.create(proxy)
       * // user.__proto__ = proxy
       * // access follows: user[__sv_raw] = user.__proto__[__sv_raw]
       * ```
       */
      return
    }

    const targetIsArray = isArray(target)

    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      // make sure this in arrayInstrumentations.values() = receiver
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    const value = Reflect.get(target, key, receiver)

    // STEP: 2. dependencies collection
    track(target, key)

    if (shallow) return value

    if (isRef(value)) {
      // 1. reactive({refObj}).refObj => refObj.value
      // 2.1. reactive([refObj])[0] => refObj
      // 2.2. reactive([refObj]).length => length
      return targetIsArray && isIntegerKey(key) ? value : value.value
    }

    if (isObject(value)) {
      /**
       * light: lazy reactive for deep reactiveObj, only reactive it when access
       * main difference between shallow and normal
       */
      return reactive(value)
    }
    return value
  }
  set(target: Target, key: string | symbol, newVal: unknown, receiver: object): boolean {
    let oldVal = target[key]
    const shallow = this.shallow

    if (!shallow) {
      if (!isShallow(newVal)) {
        oldVal = toRaw(oldVal)
        newVal = toRaw(newVal)
      }

      if (isRef(oldVal) && !isRef(newVal)) {
        oldVal.value = newVal
        return true
      }
    }

    const result = Reflect.set(target, key, newVal, receiver)

    if (target === toRaw(receiver) && oldVal !== newVal) {
      trigger(target, key, newVal, oldVal)
    }
    return result
  }
}

const mutableHandler = new MutableReactiveHandler()
const shallowHandler = new MutableReactiveHandler(true)

export { MutableReactiveHandler, mutableHandler, shallowHandler }
