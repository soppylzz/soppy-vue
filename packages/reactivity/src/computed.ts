import { isFunction } from "@soppy-vue/shared"
import { ReactiveEffect } from "./effect"
import type { Dep } from "./dep"
import { trackRefValue, triggerRefValue } from "./ref"

class ComputedRefImpl {
  _value: any
  _dep?: Dep

  effect: ReactiveEffect

  constructor(
    getter: any,
    public setter: any
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
    if (this.effect.dirty) {
      // light: collect when access this.value
      this._value = this.effect.run()
    }
    /**
     * STEP: 1. dependencies collection
     * collect deps should be related to execution
     * of `effect`, not to the data content
     */
    trackRefValue(this)
    return this._value
  }
  set value(newVal) {
    this.setter(newVal)
  }
}

function computed(getterOrOptions: any) {
  const onlyGetter = isFunction(getterOrOptions)

  let getter, setter
  if (onlyGetter) {
    getter = getterOrOptions
    setter = () => {}
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }
  return new ComputedRefImpl(getter, setter)
}

export { computed }
