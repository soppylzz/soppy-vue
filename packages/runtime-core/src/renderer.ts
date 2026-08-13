import { EMPTY_ARR, EMPTY_OBJ, isReservedProp, PatchFlags, ShapeFlags } from "@soppy-vue/shared"
import type { VNode, VNodeArrayChildren, VNodeKey } from "./vnode"
import { Fragment, isSameVNodeType, normalizeVNode, Text } from "./vnode"
import type { Data } from "./component"

/**
 * light: decoupling the render process from DOM specification
 *
 * `RendererNode` & `RendererElement` are treated as placeholder here, **NOT** parent type.
 * the actual generics used affect out implementation of `RendererOptions`
 */
interface RendererNode {
  [k: string]: any
}
interface RendererElement extends RendererNode {}

interface RendererOptions<HostNode = RendererNode, HostElement = RendererElement> {
  patchProp(el: HostElement, key: string, prevValue: any, nextValue: any): void
  insert(node: HostNode, parent: HostElement, anchor?: HostNode | null): void
  remove(node: HostNode): void
  createElement(type: string): HostElement
  setElementText(el: HostElement, text: string): void

  createText(text: string): HostNode
  setText(node: HostNode, text: string): void

  // in DOM tree, leafs can be accepted by Element/Node, non-leafs must be Element
  parentNode(node: HostNode): HostElement | null
  nextSibling(node: HostNode): HostNode | null
}

/**
 * why is the “Root” prefix used here?
 * - add semantic information
 * - distinguish between `BlockRenderFn` and `ComponentRenderFn`
 */
type RootRenderFunction<HostElement = RendererElement> = (
  vnode: VNode | null,
  container: HostElement
) => void

interface Renderer<HostElement = RendererElement> {
  render: RootRenderFunction<HostElement>
}

/**
 * LIS: https://en.wikipedia.org/wiki/Longest_increasing_subsequence
 * @returns index array of LIS, exclude arr[i] = 0
 */
function LIS(arr: number[]): number[] {
  // prev[i] = predecessor index of `i` in a LIS, later to fill
  const prev = arr.slice()

  // this is the "top card" of each pile in Patience Sorting
  const pileTop = [0]

  let curIdx, curVal, left, right

  for (curIdx = 0; curIdx < arr.length; curIdx++) {
    curVal = arr[curIdx]

    // vue-special implementation, to skip new mount vnode
    if (curVal === 0) continue

    // case 1: current value is larger than all pile tops, build new pile
    const lastPileTop = pileTop[pileTop.length - 1]
    if (arr[lastPileTop] < curVal) {
      prev[curIdx] = lastPileTop
      pileTop.push(curIdx)
      continue
    }

    // case 2: find the **leftmost** pile where top >= curVal
    left = 0
    right = pileTop.length - 1
    while (left < right) {
      const mid = (left + right) >> 1
      if (arr[pileTop[mid]] < curVal) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    if (curVal < arr[pileTop[left]]) {
      pileTop[left] = curIdx
      if (left > 0) {
        prev[curIdx] = pileTop[left - 1]
      }
    }
  }

  /**
   * backtrack to reconstruct one LIS from predecessor pointers
   * remove the useless `pileTop[i]` from subsequent updates
   */
  curIdx = pileTop.length - 1
  curVal = pileTop[curIdx]

  while (curIdx > 0) {
    pileTop[curIdx] = curVal
    curVal = prev[curVal]
    curIdx--
  }

  return pileTop
}

function createBaseRenderer<HostNode = RendererNode, HostElement = RendererElement>(
  options: RendererOptions<HostNode, HostElement>
): Renderer<HostElement>

function createBaseRenderer(options: RendererOptions): Renderer {
  // runtime-core use render unit-function provided by developers,
  // use `host` prefix to distinguish between internal methods
  const {
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setElementText: hostSetElementText,
    setText: hostSetText,
    // parentNode: hostParentNode,
    // nextSibling: hostNextSibling,
    patchProp: hostPatchProp,
  } = options

  const patchProps = (el: RendererNode, oldProps: Data, newProps: Data) => {
    if (oldProps !== newProps) {
      // de-attach all oldProps
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (isReservedProp(key) || key in newProps) continue
          hostPatchProp(el, key, oldProps[key], null)
        }
      }
      // attach all newProps
      for (const key in newProps) {
        if (isReservedProp(key)) continue
        const next = newProps[key]
        const prev = oldProps[key]
        if (next === prev) continue
        hostPatchProp(el, key, prev, next)
      }
    }
  }

  /* ==================== exposed methods ==================== */
  const render: RootRenderFunction = (vnode, container) => {
    if (vnode == null) {
      container._vnode && unmount(container._vnode, null)
    } else {
      patch(container._vnode || null, vnode, container)
    }
    // bind a vnode to a real HostElement, enable bi-directional access
    container._vnode = vnode
  }

  /* ==================== internal methods (main) ==================== */
  const patch = (
    n1: VNode | null, // null indicates this is a mount point
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null = null,
    parentComponent: any = null
  ) => {
    // vnode remain unchanged, skip
    if (n1 === n2) return

    // type change, execute the mount process
    if (n1 && !isSameVNodeType(n1, n2)) {
      unmount(n1, parentComponent)
      n1 = null
    }

    const { type, shapeFlag } = n2
    switch (type) {
      /**
       * synchronize the changes to VNodeTypes with case-statement here,
       * to enable the rendering of certain special vnode, like:
       * - `Comment`, `Static`, **`Fragment`**
       */
      case Text: {
        processText(n1, n2, container, anchor)
        break
      }
      case Fragment: {
        processFragement(n1, n2, container, anchor, parentComponent)
        break
      }
      default: {
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor, parentComponent)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(n1, n2, container, anchor, parentComponent)
        }
        // in DEV mode, issue a warning if not matching
      }
    }
  }

  const remove = (vnode: VNode) => {
    const { type, el } = vnode

    // if current type is special, redirect to speific removeFn
    void type

    const performRemove = () => {
      hostRemove(el!)
    }

    /**
     * customize additional pre-remove process here
     * such as run transition `leave()` of origin vue
     */
    performRemove()
  }

  const unmount = (vnode: VNode, parentComponent?: any) => {
    const { type, shapeFlag, children } = vnode

    /**
     * in origin vue, parentComponent used for:
     * - invokeHooks for vnode
     * - support for implementation of keep-alive API
     * - pass component instance to the recursive call tree
     */
    void parentComponent

    if (shapeFlag & ShapeFlags.COMPONENT) {
      // process the component separately
      unmountComponent(vnode.component!)
    } else {
      // recursive unmount other vnode here
      if (type === Fragment) {
        unmountChildren(children as VNode[], parentComponent)
      }

      // all types of vnodes should eventually be deleted
      remove(vnode)
    }
  }

  /* ==================== internal methods (text) ==================== */
  const processText = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null
  ) => {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateText(n2.children as string)), container, anchor)
    } else {
      const el = (n2.el = n1.el!)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children as string)
      }
    }
  }

  /* ==================== internal methods (fragment) ==================== */
  const processFragement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {
    // light: save startAnchor to `vnode.el`, save endAnchor to `vnode.anchor` to fix the range
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(""))!
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(""))!

    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)

      mountChildren(
        n2.children as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent
      )
    } else {
      patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent)
    }
  }

  /* ==================== internal methods (element) ==================== */
  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {
    const { props, shapeFlag } = vnode
    const el: RendererElement = (vnode.el = hostCreateElement(vnode.type as string))

    /**
     * origin comment:
     * mount children first, since some props may rely on child content
     * being already rendered, e.g. `<select value>`
     */
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // mountChildren
      mountChildren(vnode.children, el, anchor, parentComponent)
    }

    if (props) {
      for (const key in props) {
        if (isReservedProp(key)) continue
        hostPatchProp(el, key, null, props[key])
      }
    }

    hostInsert(el, container, anchor)
  }

  const patchElement = (n1: VNode, n2: VNode, parentComponent: any) => {
    // as a vnode awaiting rendering, `n2.el` is not bound to an actual DOM element. reuse `n1.el` here
    const el = (n2.el = n1.el!)
    const { patchFlag } = n2

    const oldProps = n1.props || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ

    // 1. patch children
    patchChildren(n1, n2, el, null, parentComponent)

    // 2. patch self-props
    if (patchFlag > 0) {
      // 2.1. patch node attributes
      if (patchFlag & PatchFlags.FULL_PROPS) {
        patchProps(el, oldProps, newProps)
      } else {
        if (patchFlag & PatchFlags.CLASS) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class)
          }
        }

        if (patchFlag & PatchFlags.STYLE) {
          hostPatchProp(el, "style", oldProps.style, newProps.style)
        }

        /**
         * update dynamic props by certain `n2.dynamicKeys`.
         * use `patchProps` to implement it for now
         */
        if (patchFlag & PatchFlags.PROPS) {
          patchProps(el, oldProps, newProps)
        }
      }

      // 2.2. patch element text
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children as string)
        }
      }
    } else {
      // 2.0. backstop of patch unmatch
      patchProps(el, oldProps, newProps)
    }
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {
    n1 == null
      ? mountElement(n2, container, anchor, parentComponent)
      : patchElement(n1, n2, parentComponent)
  }

  /* ==================== WIP:internal methods (component) ==================== */
  const mountComponent = (
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {}

  const unmountComponent = (instance: any) => {}

  const updateComponent = (n1: VNode, n2: VNode) => {}

  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {
    if (n1 == null) {
      mountComponent(n2, container, anchor, parentComponent)
    } else {
      updateComponent(n1, n2)
    }
  }

  /* ==================== internal methods (children) ==================== */
  const mountChildren = (
    children: any,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any,
    start: number = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      const child = children[i]
      patch(null, child, container, anchor, parentComponent)
    }
  }

  const unmountChildren = (children: VNode[], parentComponent: any, start: number = 0) => {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent)
    }
  }

  /**
   * during a single rendering process, vue performs a DFS of the entire vnode tree:
   * - `patch` is responsible for driving the recursive traversal
   * - `patchChildren` handles the downstream logic of `patch`, specifically to handle `vnode.children`
   */
  const patchChildren = (
    n1: VNode,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {
    const c1 = n1 && n1.children
    const c2 = n2 && n2.children

    const { shapeFlag: prevShapeFlag = 0 } = n1
    const { shapeFlag } = n2

    // use `patchUnkeyedChildren` / `patchKeyedChildren` to handle FRAGMENT patch
    // if (patchFlag & PatchFlags.FRAGMENT) {}

    // origin comment: 3 situation: text, array or no children
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 1. any to text
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[], parentComponent)
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2 as string)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 2. array to array
          patchKeyedChildren(
            c1 as VNode[],
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent
          )
        } else {
          /**
           * 3. array to null
           * Why do we unmount c1 without mounting c2?
           * - `vnode.children` is typed as `VNodeNormalizedChildren`
           * - After excluding `VNode[]` and `string`, the only valid value is `null`
           * - Therefore, there are no new children to mount
           */
          unmountChildren(c1 as VNode[], parentComponent)
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 4. text to non-text
          hostSetElementText(container, "")
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 4.1 text to array
          mountChildren(c2, container, anchor, parentComponent)
        }
      }
    }
  }

  /**
   * used simple diff algorithm similar to the one used in Effect.deps
   * to implement diff, only patch same position child
   */
  const patchUnkeyedChildren = (
    c1: VNode[],
    c2: VNodeArrayChildren,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: any
  ) => {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR

    const oldLength = c1.length
    const newLength = c2.length

    const commonLength = Math.min(oldLength, newLength)
    for (let i = 0; i < commonLength; i++) {
      patch(c1[i], normalizeVNode(c2[i]), container, null, parentComponent)
    }

    if (oldLength > newLength) {
      unmountChildren(c1, parentComponent, commonLength)
    } else {
      mountChildren(c2, container, anchor, parentComponent, commonLength)
    }
  }

  /**
   * diff core: use LIS to implement children patch
   */
  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNodeArrayChildren,
    container: RendererElement,
    parentAnchor: RendererNode | null,
    parentComponent: any
  ) => {
    /* =============== preprocess =============== */
    // preprocess common prefixes / suffixes to prune the execution flow

    const l1 = c1.length,
      l2 = c2.length
    let i,
      j,
      s = 0,
      e1 = l1 - 1,
      e2 = l2 - 1

    for (; s < Math.min(l1, l2); s++) {
      const child = normalizeVNode(c2[s])
      if (isSameVNodeType(c1[s], child)) {
        patch(c1[s], child, container, null, parentComponent)
      } else {
        break
      }
    }
    while (e1 >= s && e2 >= s) {
      const child = normalizeVNode(c2[e2])
      if (isSameVNodeType(c1[e1], child)) {
        patch(c1[e1], child, container, null, parentComponent)
      } else {
        break
      }
      e1--
      e2--
    }

    // handle only new mount points
    if (s > e1) {
      if (e2 >= s) {
        for (i = s; i <= e2; i++) {
          const nextPos = e2 + 1
          const anchor = nextPos < l2 ? (c2[nextPos] as VNode).el : parentAnchor
          patch(null, normalizeVNode(c2[i]), container, anchor, parentComponent)
        }
      }
      return
    }

    // handle only unmount points
    if (s > e2) {
      if (e1 >= s) {
        for (i = s; i <= e1; i++) {
          unmount(c1[i], parentComponent)
        }
      }
      return
    }

    /* =============== process =============== */
    const s1 = s,
      s2 = s

    // generate new VNode to new order map
    const keyToNewIndexMap = new Map<VNodeKey, number>()
    for (i = s2; i <= e2; i++) {
      const child = normalizeVNode(c2[i])
      if (child.key != null) {
        keyToNewIndexMap.set(child.key, i)
      }
    }

    let moved = false
    let patched = 0
    const toBePatched = e2 - s2 + 1
    let maxNewIndexSoFar = 0

    // generate new VNode to old order map
    const newIndexToOldIndexMap = new Array(toBePatched).fill(0)
    for (i = s1; i <= e1; i++) {
      const prevChild = c1[i]
      if (patched >= toBePatched) {
        unmount(prevChild, parentComponent)
        continue
      }
      let newIndex
      if (prevChild.key != null) {
        newIndex = keyToNewIndexMap.get(prevChild.key)
      } else {
        for (j = s2; j <= e2; j++) {
          if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j] as VNode)) {
            newIndex = j
            break
          }
        }
      }

      if (newIndex === undefined) {
        unmount(prevChild, parentComponent)
      } else {
        // `i + 1` helps distinguish the initial value of 0
        newIndexToOldIndexMap[newIndex - s2] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex
        } else {
          moved = true
        }
        patch(prevChild, c2[newIndex] as VNode, container, null, parentComponent)
        patched++
      }
    }

    // mount & move
    const sequence = moved ? LIS(newIndexToOldIndexMap) : EMPTY_ARR

    j = sequence.length - 1
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex] as VNode
      const anchor = nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor

      if (newIndexToOldIndexMap[i] === 0) {
        patch(null, nextChild, container, anchor, parentComponent)
      } else if (moved) {
        if (j < 0 || i !== sequence[j]) {
          move(nextChild, container, anchor)
        } else {
          j--
        }
      }
    }
  }

  /**
   * element.insertBefore can handle moving existing DOM elements
   */
  const move = (vnode: VNode, container: RendererElement, anchor: RendererNode | null) => {
    const { el, shapeFlag } = vnode
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // move(vnode.component)
      return
    }
    hostInsert(el!, container, anchor)
  }

  return { render }
}

function createRenderer<HostNode = RendererNode, HostElement = RendererElement>(
  options: RendererOptions<HostNode, HostElement>
) {
  return createBaseRenderer(options)
}

export { createRenderer }
export type { RendererOptions, RendererNode, RendererElement }
