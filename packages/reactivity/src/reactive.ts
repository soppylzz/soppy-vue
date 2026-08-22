import { isObject } from "@soppy-vue/shared"
import { mutableHandler, MutableReactiveHandler, shallowHandler } from "./baseHandler"
import { ReactiveFlags } from "./constants"
import type { Ref, UnwrapRefSimple } from "./ref"

interface Target {
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_REF]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.RAW]?: any
}

type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>
// light: UnwrapNestedRefs<T> may return primitive, use & to exclude
type Reactive<T> = UnwrapNestedRefs<T> & {}

declare const ShallowReactiveMarker: unique symbol
type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }

export type { UnwrapNestedRefs, Reactive, Target, ShallowReactive }

/* ==================== main api ==================== */
function createBaseReactiveObject(
  target: Target,
  handler: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  if (!isObject(target)) return target

  /**
   * when target has been proxied, falling under two case as follow
   * - can find in proxyMap, return cached object
   * - can find [ReactiveFlags.RAW] in proto-chain (userProxy)
   */
  if (target[ReactiveFlags.RAW]) return target
  const existProxy = proxyMap.get(target)
  if (existProxy) return existProxy

  // omit: validate target type

  // STEP: 1. data proxy
  const proxy = new Proxy(target, handler)
  proxyMap.set(target, proxy)
  return proxy
}

function reactive<T extends object>(target: T): UnwrapNestedRefs<T>

function reactive(target: object) {
  return createBaseReactiveObject(target, mutableHandler, MutableReactiveHandler.reactiveMap)
}

function shallowReactive<T extends object>(target: T): ShallowReactive<T> {
  return createBaseReactiveObject(target, shallowHandler, MutableReactiveHandler.shallowReactiveMap)
}

export { reactive, shallowReactive }

/* ==================== reactive utils ==================== */
function toReactive<T>(target: T): T {
  return isObject(target) ? reactive(target) : target
}

// only effect on reactive proxy, ref use `toValue`
function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  // recursion exit: raw = undefined
  return raw ? toRaw(raw) : observed
}

function isReactive(value: unknown): boolean {
  return !!((value as any)[ReactiveFlags.IS_REACTIVE] === true)
}

function isShallow(value: unknown): boolean {
  return !!((value as any)[ReactiveFlags.IS_SHALLOW] === true)
}

/**
 * alias of `isReactive()` kept for API parity with official vue3.
 * since not `readonly()` exists in our impl
 */
function isProxy(value: unknown): boolean {
  // isReactive(value) || isReadonly(value)
  return isReactive(value)
}

export { toReactive, toRaw, isReactive, isShallow, isProxy }
