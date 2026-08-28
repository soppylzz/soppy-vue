# @soppy-vue/runtime-core

A Vue-like runtime implementation that is **platform-agnostic**.

It consumes the `RendererOptions` interface (host-specific `nodeOps` + `patchProp`) and executes the unified rendering logic: VNode creation, `patch` / diff, component mounting and lifecycle. It also implements the scheduler (`nextTick`), the component API (`provide` / `inject`, lifecycle hooks) and built-in components such as `KeepAlive`, `BaseTransition` and `Teleport`. Note that there is no `h()` — by design you use `createVNode()` directly. `@soppy-vue/runtime-dom` provides the browser implementation of `RendererOptions` on top of this package.
