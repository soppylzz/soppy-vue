---
"@soppy-vue/runtime-core": minor
---

Initial release of `@soppy-vue/runtime-core`:

- Renderer with block-tree based patching (`openBlock`/`createBlock`/`toggleBlockTrack`) and vnode helpers (`createVNode`, `cloneVNode`, `Fragment`, `Text`, `Comment`).
- Component lifecycle hooks (`onBeforeMount`/`onMounted`/`onUpdated`/`onUnmounted`, ...), `provide`/`inject`, and the `watch`/`watchEffect` runtime APIs.
- Scheduler utilities: `nextTick`, `queuePostFlushCbs`.
- Built-in components: `KeepAlive` (+`onActivated`/`onDeactivated`), `Transition`/`BaseTransition`, `Teleport`.
- `createRenderer` for building custom platform renderers.
