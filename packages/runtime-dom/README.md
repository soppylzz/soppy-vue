# @soppy-vue/runtime-dom

A Vue-like runtime implementation for the **browser**.

It implements the `RendererOptions` interface with real DOM operations (`nodeOps` + `patchProp`) and provides a pre-built `render` function, so the browser renderer is ready to use out of the box. It also hosts the DOM-only `Transition` component, and re-exports everything from `@soppy-vue/runtime-core`. It is re-exported from the public entry `soppy-vue`.
