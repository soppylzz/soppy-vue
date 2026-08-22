import { extend } from "@soppy-vue/shared"
import { patchProp } from "./patchProp"
import { nodeOps } from "./nodeOps"
import { createRenderer } from "@soppy-vue/runtime-core"

/**
 * re-export everything from runtime-core
 * dependency map: soppy-vue => @soppy-vue/runtime-dom => @soppy-vue/runtime-core => @soppy-vue/reactivity
 */
export * from "@soppy-vue/runtime-core"

/**
 * unified toolbox for real DOM manipulating
 * merge the node-operation methods with the prop-operation methods
 */
const rendererOptions = extend({ patchProp }, nodeOps)

const render = (vnode: any, container: any) => {
  return createRenderer(rendererOptions).render(vnode, container)
}

export { render }
