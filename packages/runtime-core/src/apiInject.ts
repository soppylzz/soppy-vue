import { isFunction } from "@soppy-vue/shared"
import { currentInstance, getCurrentInstance } from "./component"

// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
interface InjectionKey<T> extends Symbol {}

function provide<T, K = InjectionKey<T>>(key: K, value: K extends InjectionKey<infer V> ? V : T) {
  if (currentInstance) {
    let provides = currentInstance.provides
    const parentProvides = currentInstance.parent && currentInstance.parent.provides
    if (parentProvides === provides) {
      // light: implement provide/inject inheritance using prototype chain
      provides = currentInstance.provides = Object.create(parentProvides)
    }
    provides[key as string] = value
  }
}

function inject<T>(key: InjectionKey<T> | string): T | undefined
function inject<T>(key: InjectionKey<T> | string, defaultValue?: T | { (): T }): T
function inject(key: InjectionKey<any> | string, defaultValue?: unknown) {
  const instance = getCurrentInstance()

  if (instance) {
    const provides = instance.parent ? instance.parent.provides : {}

    /**
     * note the distinctions regarding usage scenarios of `in`
     * - for [string] in obj
     * - [PropertyKey] in obj
     */
    if (provides && (key as string | symbol) in provides) {
      return provides[key as string]
    } else if (arguments.length > 1) {
      return isFunction(defaultValue)
        ? // call with instance context
          defaultValue.call(instance && instance.proxy)
        : defaultValue
    }
  }
}

function hasInjectionContext(): boolean {
  return !!getCurrentInstance()
}

export type { InjectionKey }
export { provide, inject, hasInjectionContext }
