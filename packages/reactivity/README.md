# @soppy-vue/reactivity

A Vue-like implementation of the reactivity system.

Provides `ref` / `reactive` / `computed` / `effect` / `watch`, along with their type utilities (`UnwrapRef`, `UnwrapNestedRefs`) and type guards (`isRef`, `isReactive`). The system is built on `Proxy` + `Reflect`, using per-property `Dep` sets and a lazy `ReactiveEffect` for dependency collection. It is consumed by `@soppy-vue/runtime-core` and re-exported from the public entry `soppy-vue`.
