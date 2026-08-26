import type { KeysMatching, MaybeArray } from "@soppy-vue/shared"
import {
  ensureArray,
  extend,
  isArray,
  isFunction,
  isObject,
  isOn,
  isString,
  PatchFlags,
  ShapeFlags,
} from "@soppy-vue/shared"
import { normalizeClass, normalizeStyle } from "./props"
import type {
  Teleport,
  TeleportImpl,
  TransitionHooks,
  Component,
  ComponentInternalInstance,
  Data,
  RawSlots,
} from "./component"
import { currentRenderingInstance, isTeleport } from "./component"
import type { RendererElement, RendererNode } from "./renderer"
import { RuntimeFlags } from "./constant"
import { isProxy } from "@soppy-vue/reactivity"
import { currentBlock, isBlockTrackActive } from "./block"

/**
 * official vue accept many types, even `VNode`. this happens in cases like
 * @example <component :is="vnode"/>
 */
const Text = Symbol.for("sv-text")
const Comment = Symbol.for("sv-comment")
const Fragment = Symbol.for("sv-fragment")

export { Text, Fragment, Comment }

type VNodeTypes =
  | string
  | Component
  | typeof Text
  | typeof Comment
  | typeof Fragment
  | typeof Teleport
  | typeof TeleportImpl // for internal type assertion

declare const VNodeMountSymbol: unique symbol
declare const VNodeUpdateSymbol: unique symbol

type VNodeMountHook = { (vnode: VNode): void; [VNodeMountSymbol]: true }
type VNodeUpdateHook = { (vnode: VNode, prevVNode: VNode): void; [VNodeUpdateSymbol]: true }

type VNodeHookRegistry = {
  onVNodeBeforeMount: VNodeMountHook
  onVNodeMounted: VNodeMountHook

  onVNodeBeforeUpdate: VNodeUpdateHook
  onVNodeUpdated: VNodeUpdateHook

  onVNodeBeforeUnmount: VNodeMountHook
  onVNodeUnmounted: VNodeMountHook
}

type VNodeHookKeys<T> = KeysMatching<VNodeHookRegistry, T>

type VNodeHooks = {
  [K in keyof VNodeHookRegistry]?: MaybeArray<VNodeHookRegistry[K]>
}

type VNodeProps = {
  key?: string | number | symbol
} & VNodeHooks

type VNodeKey = string | number | symbol | null

type VNodeChildAtom = VNode | string | number | boolean | null | undefined
// light: allow nested array as vnode.children
type VNodeArrayChildren = (VNodeArrayChildren | VNodeChildAtom)[]
type VNodeChild = VNodeChildAtom | VNodeArrayChildren
type VNodeNormalizedChildren = string | VNodeArrayChildren | null

export type {
  VNodeTypes,
  VNodeProps,
  VNodeArrayChildren,
  VNodeChild,
  VNodeNormalizedChildren,
  VNodeKey,
}

/**
 * implementation of official vue3 is as follows:
 * addons explanation:
 *  - `HostElement`: related to implementation of `teleport`, `transition`
 *  - `ExtraProps`: extends prop defination via `props: (VNodeProps & ExtraProps) | null`
 */
interface VNode<
  HostNode = RendererNode,
  // consumed by transition hooks
  HostElement = RendererElement,
  ExtraProps = { [key: string]: any },
> {
  [RuntimeFlags.IS_VNODE]: true
  type: VNodeTypes
  // ensure `props.class` can be accepted
  props: (VNodeProps & ExtraProps) | null
  /**
   * shapeFlag should be classified as a primitive type; the main
   * runtime optimization for it is whether to normalize `vnode`
   * **IN** rendering
   */
  shapeFlag: number
  children: VNodeNormalizedChildren
  component: ComponentInternalInstance | null

  /**
   * light: diff requires
   * - el: store real dom object
   * - key: for diff processing
   */
  key: VNodeKey
  el: HostNode | null
  // fragment anchor
  anchor: HostNode | null

  // optimize runtime
  patchFlag: number
  dynamicChildren: VNode[] | null

  // transition impl
  transition: TransitionHooks<HostElement> | null

  // teleport impl
  target: HostElement | null
  targetAnchor: HostNode | null
}

export type { VNode }

/* ==================== create utils ==================== */
function createTextNode(text: string, patchFlag: number = 0) {
  return createVNode(Text, null, text, patchFlag)
}

/* ==================== norm utils ==================== */
const normalizeKey = ({ key }: VNodeProps): VNode["key"] => (key != null ? key : null)

/**
 * mainly used for render, function as follows:
 * - ensure child is vnodes
 * - auto-wrap children array with Fragment
 * fix: optimize normalizeVNode processing logic
 */
function normalizeVNode(child: VNodeChild): VNode {
  // `null | boolean` is handled as a comment
  if (child == null || typeof child === "boolean") return createVNode(Comment)

  if (isArray(child)) {
    return createVNode(
      Fragment,
      null,
      // origin comment: avoid reference pollution when reusing vnode (#3666)
      child.slice()
    )
  }

  /**
   * light: null is already filtered out above, so only objects
   * reach here. official vue use `typeof` check at the point
   */
  if (isObject(child)) return cloneIfMounted(child)

  // process `string | number` here
  return createVNode(Text, null, String(child))
}

function normalizeChildren(vnode: VNode, children: unknown) {
  let type
  const { shapeFlag } = vnode
  if (children == null) {
    /**
     * light: use `==` to compare, enable auto-type-transform,
     * normalized null-like children
     */
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (isObject(children)) {
    if (shapeFlag & (ShapeFlags.ELEMENT | ShapeFlags.TELEPORT)) {
      const slot = (children as any).default
      slot && normalizeChildren(vnode, slot())
      return
    } else {
      // note: build `rawSlots` in optional comp
      type = ShapeFlags.SLOTS_CHILDREN
      ;(children as RawSlots)._ctx = currentRenderingInstance
    }
  } else if (isFunction(children)) {
    // note: build `rawSlots` in functional comp
    type = ShapeFlags.SLOTS_CHILDREN
    children = { default: children, _ctx: currentRenderingInstance }
  } else {
    // fallback normalize
    children = String(children)
    if (shapeFlag & ShapeFlags.TELEPORT) {
      /**
       * light: force teleport children to be array children, details
       * are mentioned in the teleport implementation
       */
      type = ShapeFlags.ARRAY_CHILDREN
      children = [createTextNode(children as string)]
    } else {
      type = ShapeFlags.TEXT_CHILDREN
    }
  }

  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}

function guardReactiveProps(props: (Data & VNodeProps) | null) {
  if (!props) return null
  // light: shallow copy is used here; we want to preserve
  // the reactivity of nested properties inside `props`.
  return isProxy(props) ? extend({}, props) : props
}

/* ==================== clone impl ==================== */
function mergeProps(...args: (Data & VNodeProps)[]) {
  const merged: Data = {}

  for (let i = 0; i < args.length; i++) {
    const toMerge = args[i]
    for (const key in toMerge) {
      if (key === "class") {
        if (merged.class !== toMerge.class) {
          merged.class = normalizeClass([merged.class, toMerge.class])
        }
        continue
      }

      if (key === "style") {
        merged.style = normalizeStyle([merged.style, toMerge.style])
        continue
      }

      if (isOn(key)) {
        const existing = merged[key]
        const incoming = toMerge[key]

        if (
          incoming &&
          existing !== incoming &&
          !(isArray(existing) && existing.includes(incoming))
        ) {
          merged[key] = existing ? [].concat(existing as any, incoming as any) : incoming
        }
        continue
      }

      if (key !== "") {
        merged[key] = toMerge[key]
      }
    }
  }
  return merged
}

function cloneVNode<N, E>(
  vnode: VNode<N, E>,
  extraProps?: (Data & VNodeProps) | null
): VNode<N, E> {
  const { props, patchFlag, children } = vnode
  const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props

  /**
   * light: append FULL_PROPS when cloning with existed extra props, so runtime re-checks
   * all props (Fragments exclude, because their flags is only for children fast-path)
   *
   * in official vue3, it also handles static-hoisted vnode here (patchFlag === -1). this
   * does not affect out impl
   */
  const newPatchFlag =
    extraProps && vnode.type !== Fragment ? patchFlag | PatchFlags.FULL_PROPS : patchFlag

  const cloned: VNode<N, E> = {
    [RuntimeFlags.IS_VNODE]: true,
    type: vnode.type,
    props: mergedProps,
    shapeFlag: vnode.shapeFlag,
    // official vue will deepCloneVNode children here in DEV mode
    children: children,
    component: vnode.component,

    el: vnode.el,
    anchor: vnode.anchor,
    key: mergedProps && normalizeKey(mergedProps),

    patchFlag: newPatchFlag,
    dynamicChildren: vnode.dynamicChildren,

    transition: vnode.transition,

    target: vnode.target,
    targetAnchor: vnode.targetAnchor,
  }
  return cloned
}

/**
 * light: determine whether a **VNODE IS MOUNTED** by checking whether el existed.
 * because the patch process involves vnodes comparing, we do not want those
 * vnode-refs point to same memory
 * in official vue3, this fn is also used for fast-path process in renderer.ts,
 * we'll ignore this impl
 */
function cloneIfMounted(child: VNode): VNode {
  // note: vnode.memo not impl yet
  return child.el === null && child.patchFlag !== PatchFlags.HOISTED ? child : cloneVNode(child)
}

/* ==================== create impl ==================== */
function createBaseVNode(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null,
  children: unknown = null,
  shapeFlag: number,
  patchFlag: number,
  needFullChildrenNormalization = false,
  /**
   * light: avoid a block node from tracking itself
   */
  isBlockNode = false
): VNode {
  const vnode = {
    [RuntimeFlags.IS_VNODE]: true,
    type,
    props,
    shapeFlag,
    children,
    component: null,

    el: null,
    anchor: null,
    key: props && normalizeKey(props),

    patchFlag,
    dynamicChildren: null,

    transition: null,

    target: null,
    targetAnchor: null,
  } as VNode

  if (needFullChildrenNormalization) {
    /**
     * for runtime optimization, vue exposes `creatElementVNode` and `createVNode` method
     * to compiler and developers. essentially, by controlling `needFullChildrenNormalization`,
     * - vue allows compiler to generate code that can quickly performs `normalizeChildren`.
     * - vue dosen't trust the vnode tree generated by developers via `createVNode`, thus must normalize the whole vnode tree
     */
    normalizeChildren(vnode, children)
  }

  // origin comment: track vnode for block tree
  if (
    isBlockTrackActive() &&
    currentBlock &&
    !isBlockNode &&
    /**
     * light:
     * - `patchFlag > 0` indicates vnode need patch in rendering
     * - `ShapeFlags.COMPONENT` needs to persist the instance on,
     *   to the next vnode, so that it can be unmounted
     */
    (vnode.patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT)
  ) {
    currentBlock.push(vnode)
  }

  return vnode
}

function createVNode(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  // provided when call, not auto-computed
  patchFlag: number = 0,
  isBlockNode = false
) {
  // light: valid vnode guard, using COMMENT as a fallback type
  type = type || Comment

  // origin comment: class & style normalization.
  if (props) {
    props = guardReactiveProps(props)!

    let style = props.style
    const { class: kls } = props
    if (kls && !isString(kls)) {
      props.class = normalizeClass(kls)
    }
    if (isObject(style)) {
      if (isProxy(style) && !isArray(style)) {
        // shallow copy for Proxy
        style = extend({}, style)
      }
      props.style = normalizeStyle(style)
    }
  }

  // resolve shapeFlag, can be optimized at compiled time
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isTeleport(type)
      ? ShapeFlags.TELEPORT
      : isObject(type)
        ? ShapeFlags.STATEFUL_COMPONENT
        : isFunction(type)
          ? ShapeFlags.FUNCTIONAL_COMPONENT
          : // light: for special vnode types (e.g. Comment, Text, Fragment), shapeFlag = 0
            0

  return createBaseVNode(
    type,
    props,
    children,
    shapeFlag,
    patchFlag,
    /**
     * needFullChildrenNormalization, we don't
     * trust user-created vnode
     */
    true,
    isBlockNode
  )
}

/* ==================== checks utils ==================== */
function isVNode(value: unknown): value is VNode {
  return value ? value[RuntimeFlags.IS_VNODE] === true : false
}

/**
 * since the comparison involves changes in the type of a `vnode`
 * for the same actual node, `vnode.key` must be compared.
 */
function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

/* ==================== vnode hook ==================== */
function invokeVNodeHook(hook: VNodeHookKeys<VNodeMountHook>, vnode: VNode): void

function invokeVNodeHook(hook: VNodeHookKeys<VNodeUpdateHook>, vnode: VNode, prevVNode: VNode): void

function invokeVNodeHook(hook: keyof VNodeHookRegistry, vnode: VNode, prevVNode?: VNode) {
  const rawFns = vnode?.props?.[hook]
  const hookFns = rawFns ? ensureArray(rawFns) : []
  for (const fn of hookFns) {
    ;(fn as any)(vnode, prevVNode)
  }
}

export {
  normalizeVNode,
  cloneVNode,
  // optimize for `patchChildren`
  cloneIfMounted,
  createVNode,
  // as origin `createElementVNode`
  createBaseVNode,
  isVNode,
  isSameVNodeType,
  invokeVNodeHook,
}
