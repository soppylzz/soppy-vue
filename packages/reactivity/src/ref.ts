import type { IfAny, NonNullObject } from "@soppy-vue/shared"
import type { Dep } from "./dep"
import { createDep } from "./dep"
import { activeEffect, trackEffect, triggerEffects } from "./effect"
import { toReactive } from "./reactive"
import { ReactiveFlags } from "./constants"

declare const RefSymbol: unique symbol

type Ref<T = any> = {
  value: T
  /**
   * ORIGIN:
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  [RefSymbol]: true
}

type RefBase<T> = {
  dep?: Dep
  value: T
}

type BaseTypes = string | number | boolean

type UnwrapRef<T> = T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>
type UnwrapRefSimple<T> = T extends BaseTypes | Ref
  ? T
  : T extends object
    ? {
        [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
      }
    : T

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

class RefImpl<T> {
  _value: T
  dep?: Dep;

  [ReactiveFlags.IS_REF] = true

  constructor(public rawValue: T) {
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

function createRef(value: unknown) {
  // same stragedy with reactive
  if (isRef(value)) {
    return value
  }
  return new RefImpl(value)
}

function ref<T>(value: T): Ref<UnwrapRef<T>>
function ref<T = any>(): Ref<T | undefined>
function ref(value?: unknown) {
  return createRef(value)
}

/**
 * if use `type ToRef<T> = [T] extends [Ref] ? T : Ref<T>`, `ToRef<any>` will be `any`
 * any type should discuss separately
 */
type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>
type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}
class ObjectRefImpl {
  [ReactiveFlags.IS_REF] = true

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

function toRef<T extends NonNullObject>(object: T, key: keyof T): ToRef<T> {
  const val = object[key]
  return isRef(val) ? val : (new ObjectRefImpl(object, key) as any)
}

function toRefs<T extends NonNullObject>(object: T): ToRefs<T> {
  const res: any = {}
  for (const key in object) {
    res[key] = toRef(object, key)
  }
  return res
}

/**
 * allow us to access `refVal` and `val` in a generic way within template
 * @param objectWithRefs unified entry to which all `val` are attached
 */
function proxyRefs(objectWithRefs: any) {
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)

      return isRef(value) ? value.value : ref
    },
    set(target, key, newVal, receiver) {
      const oldVal = target[key]

      if (isRef(oldVal)) {
        oldVal.value = newVal
        return true
      } else {
        return Reflect.set(target, key, newVal, receiver)
      }
    },
  })
}

function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
function isRef(r: any): r is Ref {
  return !!(r && r[ReactiveFlags.IS_REF] === true)
}

export type { Ref, UnwrapRef, UnwrapRefSimple }
export { ref, toRef, toRefs, proxyRefs, trackRefValue, triggerRefValue, isRef }
