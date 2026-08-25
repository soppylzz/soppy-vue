import type {
  ComponentInternalInstance,
  RendererElement,
  RendererNode,
  VNode,
  VNodeArrayChildren,
  VNodeProps,
} from "@soppy-vue/runtime-dom"
import { MoveTypes, RuntimeFlags, TeleportMoveTypes } from "../../constant"
import type { RendererInternals, RendererOptions } from "../../renderer"
import { isString, ShapeFlags } from "@soppy-vue/shared"

interface TeleportProps {
  to?: string | RendererElement | null
  // not-impl: disabled?: boolean
}

type TeleportVNode = VNode<RendererNode, RendererElement, TeleportProps /* as ExtraProps */>

/* ==================== base utils ==================== */
const resolveTarget = <T = RendererElement>(
  props: TeleportProps | null,
  select: RendererOptions["querySelector"]
): T | null => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    // ignore non-null checks for `select` and `target`
    const target = select(targetSelector)
    return target as T
  } else {
    // provide RendererElement directly
    return targetSelector as T
  }
}

const isTeleport = (type: any): boolean => type[RuntimeFlags.IS_TELEPORT]

/* ==================== Teleport impl ==================== */
// light: defined externally, to be reused in remove/process
const moveTeleport = (
  vnode: VNode,
  container: RendererElement,
  parentAnchor: RendererNode | null,
  internals: RendererInternals,
  moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER
) => {
  const {
    options: { insert },
    move,
  } = internals
  const { el, anchor, shapeFlag, children } = vnode

  if (moveType & TeleportMoveTypes.TARGET_CHANGE) {
    /**
     * --- why move `targetAnchor` first? ---
     * if we wanna move the target, must first move the
     * targetAnchor, due to the struct of teleport rendering
     * results:
     *
     * @example
     * ```html
     * <div id="model">
     *   <div class="dialog">teleport content</div>
     *   <!--teleport-anchor-->
     * </div>
     * ```
     */
    insert(vnode.targetAnchor!, container, parentAnchor)
  }

  const isReorder = moveType & TeleportMoveTypes.REORDER

  if (isReorder) {
    insert(el!, container, parentAnchor)
    insert(anchor!, container, parentAnchor)
  } else {
    /**
     * self-design: since `disabled` has not been impled,
     * this branch behaves slightly differently
     */
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move((children as VNode[])[i], container, parentAnchor, MoveTypes.REORDER)
      }
    }
  }
}

const TeleportImpl = {
  name: "Teleport",
  [RuntimeFlags.IS_TELEPORT]: true,
  /**
   * light: teleport's unique rendering methods, called in renderer patch
   * - process: mount and update
   * - remove: unmount
   * - move: move
   */
  patch(
    n1: TeleportVNode | null,
    n2: TeleportVNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    internals: RendererInternals
  ) {
    const {
      mountChildren,
      patchChildren,
      options: { insert, createText, createComment, querySelector /* specific api */ },
    } = internals

    const { shapeFlag, children } = n2

    // patch or mount
    if (n1 == null) {
      /**
       * insertBefore: if no anchor is specified, the element
       * is inserted at the end of the container.
       */
      const placeholder = (n2.el = createComment("teleport start"))
      const mainAnchor = (n2.anchor = createComment("teleport end"))

      // mount as a placeholder at the actual pos, related to `disable` impl
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)

      const target = (n2.target = resolveTarget(n2.props, querySelector))
      const targetAnchor = (n2.targetAnchor = createText(""))

      // ignore svg/mathml process here, mount directly
      target && insert(targetAnchor, target)

      const mount = (container: RendererElement, anchor: RendererNode) => {
        /**
         * origin comment: teleport ALWAYS has array children, this is enforced
         * both in compiler and vnode children normalization
         */
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(children as VNodeArrayChildren, container, anchor, parentComponent)
        }
      }

      target && mount(target, targetAnchor)
    } else {
      n2.el = n1.el
      const target = (n2.target = n1.target)!
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!

      patchChildren(n1, n2, target, targetAnchor, parentComponent)

      if (n2.props?.to !== n1.props?.to) {
        const nextTarget = (n2.target = resolveTarget(n2.props, querySelector))
        nextTarget && moveTeleport(n2, nextTarget, null, internals, TeleportMoveTypes.TARGET_CHANGE)
      }
    }
    // finally: updateCssVars(n2)
  },
  remove(
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    internals: RendererInternals
  ) {
    const { shapeFlag, children, anchor, targetAnchor, target } = vnode
    const {
      unmount,
      options: { remove: _remove },
    } = internals

    target && _remove(targetAnchor!)
    _remove(anchor!)

    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      for (let i = 0; i < (children as VNode[]).length; i++) {
        const child = (children as VNode[])[i]
        unmount(child, parentComponent)
      }
    }
  },
  move: moveTeleport,
}

const Teleport = TeleportImpl as unknown as {
  [RuntimeFlags.IS_TELEPORT]: true
  new (): {
    $props: VNodeProps & TeleportProps
    $slots: { default(): VNode[] }
  }
}

export type { TeleportProps }
export { Teleport, TeleportImpl, isTeleport }
