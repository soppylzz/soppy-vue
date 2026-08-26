import { isFunction, NOOP } from "@soppy-vue/shared"
import { ReactiveEffect } from "./effect"
import type { Dep } from "./dep"
import type { Ref } from "./ref"
import { trackRefValue, triggerRefValue } from "./ref"
import { ReactiveFlags } from "./constants"
import { toRaw } from "./reactive"

type ComputedGetter<T> = (oldVal?: T) => T
type ComputedSetter<T> = (newVal: T) => void

interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: ReactiveEffect<T>
}

declare const ComputedRefSymbol: unique symbol
interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

class ComputedRefImpl<T> {
  /**
   * light: assign a val when getter is executed; `_value` remains
   * in place teherafter. use `!` assertion to handle this
   */
  _value!: T
  _dep?: Dep
  effect: ReactiveEffect<T>;
  [ReactiveFlags.IS_REF] = true

  constructor(
    getter: ComputedGetter<T>,
    public setter: ComputedSetter<T>
  ) {
    /**
     * light: middle layer effect, created by `new ReactiveEffect` instead of `effect` method:
     * - do not collect automatically when creating
     * - configure `scheduler` to transmit trigger
     */
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () => {
        /**
         * STEP: 2. change dispatching
         * getter deps changed => trigger computedRef changed
         */
        triggerRefValue(this)
      }
    )
  }
  get value() {
    /**
     * origin comment: the computed ref may get wrapped by
     * other proxies e.g. readonly() (#3376)
     */
    const self = toRaw(this)

    if (self.effect.dirty) {
      // light: collect when access this.value
      self._value = self.effect.run()
    }
    /**
     * STEP: 1. dependencies collection
     * collect deps should be related to execution
     * of `effect`, not to the data content
     */
    trackRefValue(self)
    return self._value
  }
  set value(newVal: T) {
    this.setter(newVal)
  }
}

function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>
function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>
function computed(getterOrOptions: any): any {
  const onlyGetter = isFunction(getterOrOptions)

  let getter, setter
  if (onlyGetter) {
    getter = getterOrOptions
    setter = NOOP
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return new ComputedRefImpl(getter, setter)
}

export { computed }
export type { WritableComputedRef, ComputedRef }
