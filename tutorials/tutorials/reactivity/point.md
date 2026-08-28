---
title: "Computed track"
---

# Computed track

注意 `ComputedRefImpl` 的依赖收集过程不能在 if 中执行：

```ts
const handler = {
  get value() {
    if (this.effect.dirty) {
      // error: cause deps missing
      trackRefValue(this)
      this._value = this.effect.run()
    }
    return this._value
  },
}
```

依赖收集应该与 `effect` 执行过程相关，而不是与数据内容相关，以下 Demo 分析了错误产生过程：

```ts
import { ref, reactive, computed, effect } from "@soppy-vue/reactivity"

const app = document.getElementById("app")!

const count = ref(0)
const double = computed(() => count.value * 2)

effect(() => {
  app.innerHTML = `
    <h2>computed demo</h2>
    <p><strong>count:</strong> ${count.value}</p>	
    {/* [start] count.dep = {render} */}
    
    <p><strong>double:</strong> ${double.value}</p>
    {/* [start] count.dep = {render, double.effect} */}
    {/* [start] double.dep = {render} */}
  `
})
/**
 * @state render.deps: [count, double]
 * @state count.dep: { render, double.effect }
 * @state double.dep: { render }
 */

setTimeout(() => {
  count.value++
  /**
   * 1. triggerEffect({ render, double.effect })
   * @state { render.dirty: false, double.effect.dirty: false }
   *
   * @progress render.dirty = true
   * 2. render.schedule()
   * @progress count.value => track(render, count.dep)
   * @progress double.value => **double.effect.dirty is `false`, skip track**
   * @progress cleanDepEffects([double.dep], render)
   *
   * @state { render.deps: [count], double.dep: {} }
   *
   * @progress double.effect.dirty = true
   * 2. double.schedule()
   * @progress triggerRefValue(double)
   * 2.2 triggerEffect({})
   * @warn won't trigger render effect update
   */
}, 1000)
```
