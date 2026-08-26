import { EMPTY_ARR } from "@soppy-vue/shared"
import type { VNodeProps, VNodeTypes, VNode } from "./vnode"
import { createBaseVNode, createVNode } from "./vnode"
import type { Data } from "./component"

const blockStack: (VNode[] | null)[] = []
let currentBlock: VNode[] | null = null

/**
 * light: block track does not always run; `v-once` allows
 * certain dynamic vnode to avoid being tracked
 */
let blockTrackingDepth = 1

const isBlockTrackActive = () => blockTrackingDepth > 0
const toggleBlockTrack = (enable: boolean) => {
  const step = enable ? 1 : -1
  blockTrackingDepth += step
}

/* ==================== block creation ==================== */
/**
 * core block creation function, both `createElementBlock`(for compiler) and
 * `createBlock`(for user) are impled on top of this function. similar in
 * design to `createBaseVNode`
 */
function setupBlock(vnode: VNode) {
  vnode.dynamicChildren = isBlockTrackActive()
    ? // enable attach block, created in `openBlock`
      currentBlock || (EMPTY_ARR as any)
    : null

  /**
   * light: invocation sequence below:
   *   openBlock()
   *   render()
   *     setupBlock()
   *       closeBlock() <- execute below
   * so, during rendering, currentBlock = vnode.dynamicChildren
   */
  closeBlock()
  if (isBlockTrackActive() && currentBlock) {
    currentBlock.push(vnode)
  }
  return vnode
}

/* ==================== manage block ==================== */
function openBlock(enable: boolean = true) {
  // auto-enabled, vue works the same way, except it use `disableTracking=false`
  blockStack.push((currentBlock = enable ? [] : null))
}

function closeBlock() {
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
}

/* ==================== create block ==================== */
function createBaseBlock(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null,
  children: unknown = null,
  shapeFlag: number,
  patchFlag: number
) {
  return setupBlock(
    createBaseVNode(type, props, children, shapeFlag, patchFlag, false, true /* isBlock */)
  )
}

function createBlock(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0
) {
  return setupBlock(createVNode(type, props, children, patchFlag, true /* isBlock */))
}

export {
  currentBlock,
  openBlock,
  setupBlock,
  toggleBlockTrack,
  isBlockTrackActive,
  createBaseBlock,
  createBlock,
}
