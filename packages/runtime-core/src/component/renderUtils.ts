import { isModelListener, isOn, PatchFlags, ShapeFlags } from "@soppy-vue/shared"
import type { VNode } from "../vnode"
import { cloneVNode, Comment, createVNode, normalizeVNode } from "../vnode"
import type { ComponentInternalInstance, Data, FunctionalComponent } from "./component"
import { isEmitListener } from "./emits"
import type { NormalizedPropsOptions } from "./props"
import { setCurrentRenderingInstance } from "./context"

/* ==================== render utils ==================== */
function hasPropsChanged(
  prevProps: Data,
  nextProps: Data,
  emitsOptions: ComponentInternalInstance["emitsOptions"]
) {
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) return true

  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key] && !isEmitListener(emitsOptions, key)) return true
  }
  return false
}

function shouldUpdateComponent(prev: VNode, next: VNode) {
  const { props: prevProps, component } = prev
  const { props: nextProps, patchFlag } = next
  const emits = component!.emitsOptions

  if (patchFlag >= 0) {
    /**
     * optimized path for compiler-generated VNodes.
     * manually created VNodes usually have a patchFlag of 0, so this branch
     * can be ignored when reading the runtime.
     * it is kept here for the future compiler-core implementation.
     */
    if (patchFlag & PatchFlags.FULL_PROPS) {
      return !prevProps ? !!nextProps : hasPropsChanged(prevProps, nextProps!, emits)
    }
  } else {
    // quick path checks, omit fast path base on children.$stable
    if (prevProps === nextProps) return false
    if (!prevProps) return !!nextProps
    if (!nextProps) return true
    return hasPropsChanged(prevProps, nextProps, emits)
  }
  return false
}

function updateHOCHostEl({ vnode, parent }: ComponentInternalInstance, el: typeof vnode.el) {
  if (!el) return null

  while (parent) {
    const root = parent.subTree
    if (root === vnode) {
      ;(vnode = parent.vnode).el = el
      parent = parent.parent
    } else {
      break
    }
  }
}

/* ==================== render component ==================== */
function renderComponentRoot(instance: ComponentInternalInstance): VNode {
  const {
    type: Component,
    vnode,
    proxy,
    props,
    // only for `filterModelListener`
    propsOptions,
    attrs,
    slots,
    emit,
    render,
    data,
    setupState,
    ctx,
  } = instance

  let result: VNode
  let fallthroughAttrs: Data | null = null
  // light: similar to `activeEffect`, it uses fn call stack to handle recursive rendering of components
  const prev = setCurrentRenderingInstance(instance)

  try {
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // handle stateful
      const proxyToUse = proxy!
      result = normalizeVNode(
        render!.call(
          proxyToUse, // this
          proxyToUse, // ctx
          props, // $props
          setupState, // $setup
          data, // $data
          ctx // $options
        )
      )
      fallthroughAttrs = attrs
    } else {
      // handle functional
      const render = Component as FunctionalComponent
      result = normalizeVNode(
        render.length > 1 ? render(props, { attrs, slots, emit }) : render(props, null as any)
      )

      if (Component.props) {
        fallthroughAttrs = attrs
      } else {
        fallthroughAttrs = {}
        for (const key in attrs) {
          if (key === "class" || key === "style" || isOn(key)) {
            fallthroughAttrs[key] = attrs[key]
          }
        }
      }
    }
  } catch (_err) {
    // light: create COMMENT as fallback, ensure next code runs smoothly
    result = createVNode(Comment)
  }

  let root = result

  if (fallthroughAttrs) {
    const keys = Object.keys(fallthroughAttrs)
    const { shapeFlag } = root

    if (keys.length) {
      if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.COMPONENT)) {
        // handle v-model listener (e.g. onUpdate:xxx), it should not fallthrough.
        fallthroughAttrs = filterModelListeners(fallthroughAttrs, propsOptions)

        /**
         * --- why cloneVNode instead of mutating root directly? ---
         *
         * `render()` may return:
         * - a shared hoisted vnode
         * @example
         * ```js
         * const _hoisted = createVNode("div", {}, null, PatchFlags.HOISTED)
         * // always return the SAME reference
         * function render() { return _hoisted }
         * ```
         *
         * - an already-mounted instance
         * @example
         * ```js
         * // vnode cached after first mount
         * <component :is="Comp" />
         * const cached = renderComponent(Comp)
         * // next render returns the SAME cached reference
         * function render() { return cached }
         * ```
         * in summary, we must clone them for `patch(subTree, nextTree)` to take effect
         */
        root = cloneVNode(root, fallthroughAttrs)
      }
      // developer-friendly checks here
    }
  }
  // handle directives, transition
  setCurrentRenderingInstance(prev)
  return root
}

const filterModelListeners = (attrs: Data, props: NormalizedPropsOptions) => {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key, _]) => !(isModelListener(key) && key.slice(9) in props))
  )
}

export { shouldUpdateComponent, renderComponentRoot, updateHOCHostEl }
