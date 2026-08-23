import { extend } from "@soppy-vue/shared"
import type { Renderer } from "@soppy-vue/runtime-core"
import { createRenderer } from "@soppy-vue/runtime-core"
import { patchProp } from "./patchProp"
import { nodeOps } from "./nodeOps"

let renderer: Renderer<Element | ShadowRoot>
/**
 * unified toolbox for real DOM manipulating
 * merge the node-operation methods with the
 * prop-operation methods
 */
const rendererOptions = extend({ patchProp }, nodeOps)
const ensureRenderer = () =>
  renderer || (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))

// const render = ((...args) => {
//   ensureRenderer().render(...args)
// }) as RootRenderFunction<Element | ShadowRoot>
const render = ensureRenderer().render

/**
 * re-export everything from runtime-core
 * dependency map:
 *   soppy-vue =>
 *   @soppy-vue/runtime-dom =>
 *   @soppy-vue/runtime-core =>
 *   @soppy-vue/reactivity
 */
export * from "@soppy-vue/runtime-core"
export { render }
