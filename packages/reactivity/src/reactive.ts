import { isObject } from "@soppy-vue/shared"
import { mutableHandler } from "./baseHandler"
import { ReactiveFlags } from "./constants"

const reactiveMap = new WeakMap()

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

function reactive(target: unknown) {
  return createReactiveObject(target)
}

export { reactive }
