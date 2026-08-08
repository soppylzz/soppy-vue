import { isObject } from "@soppy-vue/shared"
import { mutableHandler } from "./baseHandler"
import { ReactiveFlags } from "./constants"
import type { Ref, UnwrapRefSimple } from "./ref"

const reactiveMap = new WeakMap()

type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

// light: UnwrapNestedRefs<T> may return primitive, use & to exclude
type Reactive<T> = UnwrapNestedRefs<T> & {}

function createReactiveObject(target: unknown) {
  if (!isObject(target)) return target

  // when target has been proxied, return cached reactiveObj
  const existProxy = reactiveMap.get(target)
  if (existProxy) return existProxy

  // when reactive(reactiveObj) happens, return reactiveObj
  if (target[ReactiveFlags.IS_REACTIVE]) return target

  // STEP: 1. data proxy
  const proxy = new Proxy(target, mutableHandler)
  reactiveMap.set(target, proxy)
  return proxy
}

function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
function reactive(target: object) {
  return createReactiveObject(target)
}

function toReactive<T>(target: T): T {
  return isObject(target) ? reactive(target) : target
}

function isReactive(value: unknown): boolean {
  return !!((value as any)[ReactiveFlags.IS_REACTIVE] === true)
}

export type { UnwrapNestedRefs, Reactive }
export { reactive, toReactive, isReactive }
