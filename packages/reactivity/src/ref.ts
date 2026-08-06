import type { NonNullObject } from "@soppy-vue/shared"
import type { Dep } from "./dep"
import { createDep } from "./dep"
import { activeEffect, trackEffect, triggerEffects } from "./effect"
import { toReactive } from "./reactive"

type RefBase<T> = {
  dep?: Dep
  value: T
}

/**
 * track activeEffect for ref.dep, exposed to `RefImpl` and `ComputedRefImpl`
 */
function trackRefValue(ref: RefBase<any>) {
  if (!activeEffect) return

  if (!ref.dep) {
    // refObj(ref.value) has only one dep, use "undefined" as placeholder
    ref.dep = createDep(() => (ref.dep = undefined), "undefined")
  }

  trackEffect(activeEffect, ref.dep)
}

function triggerRefValue(ref: RefBase<any>) {
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}

class RefImpl {
  __sv_isRef = true
  _value: any
  dep?: Dep

  constructor(public rawValue: any) {
    this._value = toReactive(rawValue)
  }

  get value() {
    // STEP: 1. dependencies collection
    trackRefValue(this)
    return this._value
  }
  set value(newValue) {
    if (newValue !== this.rawValue) {
      this.rawValue = newValue
      this._value = toReactive(newValue)
      // STEP: 2. change dispatching
      triggerRefValue(this)
    }
  }
}

function createRef(value: any) {
  return new RefImpl(value)
}

function ref(value: any) {
  return createRef(value)
}

class ObjectRefImpl {
  __sv_isRef = true

  constructor(
    public _object: NonNullObject,
    public _key: PropertyKey
  ) {}

  get value() {
    // light: use `proxy` to change reactiveObj.key call way, no need to re-implement deps-collect
    return this._object[this._key]
  }
  set value(newValue) {
    this._object[this._key] = newValue
  }
}

function toRef(object: NonNullObject, key: PropertyKey) {
  return new ObjectRefImpl(object, key)
}

function toRefs(object: NonNullObject) {
  const res: any = {}
  for (const key in object) {
    res[key] = toRef(object, key)
  }
  return res
}

/**
 * allow us to access `refVal` and `val` in a generic way within template
 *
 * @param objectWithRef unified entry to which all `val` are attached
 */
function proxyRefs(objectWithRef: any) {
  return new Proxy(objectWithRef, {
    get(target, key, receiver) {
      const ref = Reflect.get(target, key, receiver)
      return ref.__sv_isRef ? ref.value : ref
    },
    set(target, key, newVal, receiver) {
      const oldVal = target[key]

      if (oldVal.__sv_isRef) {
        oldVal.value = newVal
        return true
      } else {
        return Reflect.set(target, key, newVal, receiver)
      }
    },
  })
}

export { ref, toRef, toRefs, proxyRefs, trackRefValue, triggerRefValue }
