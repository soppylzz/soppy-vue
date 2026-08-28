# @soppy-vue/runtime-core

## 0.1.0

### Minor Changes

- [`41180cd`](https://github.com/soppylzz/soppy-vue/commit/41180cdc0fbe3bb895b74a37c20c0a13fb6a7296) Thanks [@soppylzz](https://github.com/soppylzz)! - Initial release of `@soppy-vue/runtime-core`:

  - Renderer with block-tree based patching (`openBlock`/`createBlock`/`toggleBlockTrack`) and vnode helpers (`createVNode`, `cloneVNode`, `Fragment`, `Text`, `Comment`).
  - Component lifecycle hooks (`onBeforeMount`/`onMounted`/`onUpdated`/`onUnmounted`, ...), `provide`/`inject`, and the `watch`/`watchEffect` runtime APIs.
  - Scheduler utilities: `nextTick`, `queuePostFlushCbs`.
  - Built-in components: `KeepAlive` (+`onActivated`/`onDeactivated`), `Transition`/`BaseTransition`, `Teleport`.
  - `createRenderer` for building custom platform renderers.

### Patch Changes

- Updated dependencies [[`41180cd`](https://github.com/soppylzz/soppy-vue/commit/41180cdc0fbe3bb895b74a37c20c0a13fb6a7296), [`41180cd`](https://github.com/soppylzz/soppy-vue/commit/41180cdc0fbe3bb895b74a37c20c0a13fb6a7296)]:
  - @soppy-vue/shared@0.1.0
  - @soppy-vue/reactivity@0.1.0
