import type { IfAny } from "@soppy-vue/shared"
import type { Dep } from "./dep"
import { createDep } from "./dep"
import { activeEffect, shouldTrack, trackEffect, triggerEffects } from "./effect"
import { isShallow, toRaw, toReactive } from "./reactive"
import { ReactiveFlags } from "./constants"
import { MutableReactiveHandler } from "./baseHandler"

/* ==================== ref type* ==================== */
declare const RefSymbol: unique symbol
type Ref<T = any> = {
  value: T
  /**
   * origin comment:
   *
   * type differentiator only. we need this to be in public d.ts
   * but don't want it to show up in IDE autocomplete, so we use
   * a private Symbol instead.
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
 * if use `type ToRef<T> = [T] extends [Ref] ? T : Ref<T>`, `ToRef<any>` will be `any`
 * any type should discuss separately
 */
type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>
type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}

declare const ShallowRefMarker: unique symbol

type ShallowRef<T = any> = Ref<T> & { [ShallowRefMarker]?: true }

export type { Ref, UnwrapRef, UnwrapRefSimple, ShallowRef }

/* ==================== track/trigger utils ==================== */
function trackRefValue(ref: RefBase<any>) {
  /**
   * track activeEffect for ref.dep, provided to `RefImpl` and `ComputedRefImpl`;
   * update: introduce shouldTrack for manully disable tracking
   */
  if (!activeEffect || !shouldTrack) return

  ref = toRaw(ref)
  if (!ref.dep) {
    // refObj(ref.value) has only one dep, use "undefined" as key
    ref.dep = createDep(() => (ref.dep = undefined), "undefined")
  }

  trackEffect(activeEffect, ref.dep, __DEV__ ? { target: ref, key: "value" } : undefined)
}

function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  /**
   * --- why toRaw(ref) here ---
   *
   * light: during normal using, a ref placed into reactive object, its internal
   * `ref.dep` (which stores dependents) is then inaccessible through the Proxy,
   * and must be reached via toRaw
   */
  ref = toRaw(ref)
  if (ref.dep) {
    triggerEffects(ref.dep, __DEV__ ? { target: ref, key: "value", newVal } : undefined)
  }
}

export { trackRefValue, triggerRefValue }

/* ==================== ref ==================== */
class RefImpl<T> {
  _value: T
  _rawValue: T
  dep?: Dep;

  [ReactiveFlags.IS_SHALLOW]?: boolean;
  [ReactiveFlags.IS_REF] = true

  constructor(value: T, shallow: boolean) {
    this._rawValue = shallow ? value : toRaw(value)
    this._value = shallow ? value : toReactive(value)
    this[ReactiveFlags.IS_SHALLOW] = shallow
  }

  get value() {
    // STEP: 1. track deps
    trackRefValue(this)
    return this._value
  }
  set value(newValue) {
    const useDirect = this[ReactiveFlags.IS_SHALLOW] || isShallow(newValue)
    newValue = useDirect ? newValue : toRaw(newValue)

    if (newValue !== this._rawValue) {
      this._rawValue = newValue
      this._value = useDirect ? newValue : toReactive(newValue)
      // STEP: 2. trigger deps
      triggerRefValue(this, newValue)
    }
  }
}

/**
 * light: vue allows set `value=undefined` to ref / shallowRef;
 * this is syntax sugar for binding to html (e.g. `const el = ref<HTMLElement>()`)
 */
function createRef(value: unknown, shallow: boolean) {
  // same stragedy with reactive
  if (isRef(value)) return value
  return new RefImpl(value, shallow)
}

function ref<T>(value: T): Ref<UnwrapRef<T>>
function ref<T = any>(): Ref<T | undefined>
function ref(value?: unknown) {
  return createRef(value, false)
}

function shallowRef<T>(value: T): [T] extends [Ref] ? IfAny<T, ShallowRef<T>, T> : ShallowRef<T>
function shallowRef<T = any>(): ShallowRef<T | undefined>
function shallowRef(value?: unknown) {
  return createRef(value, true)
}

export { ref, shallowRef }

/* ==================== ref utils ==================== */
function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
function isRef(r: any): r is Ref {
  return !!(r && r[ReactiveFlags.IS_REF] === true)
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  [ReactiveFlags.IS_REF] = true

  constructor(
    private _object: T,
    private _key: K
  ) {}

  get value() {
    // light: use `proxy` to change reactiveObj.key call way, no need to re-implement deps-collect
    return this._object[this._key]
  }
  set value(newValue) {
    this._object[this._key] = newValue
  }

  get dep(): Dep | undefined {
    const target = toRaw(this._object)
    return MutableReactiveHandler.reactiveMap.get(target)?.get(this._key)
  }
}

/**
 * this is a simplified impl of vue3 `toRef`, it corresponds
 * exactly to vue's internal `propertyToRef` used to create a
 * ref from a property of a reactive object.
 *
 * in official vue3, it supports:
 * - existing refs (return as-is)
 * - getters (create computed-like ref)
 * - plain values (wrap with `ref`)
 * - **object props** (this impl)
 */
function toRef<T extends Record<string, any>, K extends keyof T>(object: T, key: K): ToRef<T[K]> {
  const val = object[key]
  return isRef(val) ? val : (new ObjectRefImpl(object, key) as any)
}

function toRefs<T extends object>(object: T): ToRefs<T> {
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

function triggerRef(ref: Ref) {
  return triggerRefValue(ref, __DEV__ ? ref.value : undefined)
}

export { isRef, toRef, toRefs, proxyRefs, triggerRef }
