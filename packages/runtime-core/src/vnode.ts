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
import {
  currentRenderingInstance,
  type Component,
  type ComponentInternalInstance,
  type Data,
  type RawSlots,
} from "./component"
import type { RendererNode } from "./renderer"
import { VNodeInternals } from "./constant"
import { isProxy } from "@soppy-vue/reactivity"

/**
 * official vue accept many types, even `VNode`. this happens in cases like
 * @example <component :is="vnode"/>
 */
const Text = Symbol.for("sv-text")
const Comment = Symbol.for("sv-comment")
const Fragment = Symbol.for("sv-fragment")

export { Text, Fragment, Comment }

type VNodeTypes = string | Component | typeof Text | typeof Fragment | typeof Comment

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
interface VNode<HostNode = RendererNode, ExtraProps = { [key: string]: any }> {
  [VNodeInternals.IS_VNODE]: true
  type: VNodeTypes
  // ensure `props.class` can accepted
  props: (VNodeProps & ExtraProps) | null
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
  shapeFlag: number
  patchFlag: number
}

export type { VNode }

/* ==================== norm utils ==================== */
const normalizeKey = ({ key }: VNodeProps): VNode["key"] => (key != null ? key : null)

/**
 * mainly used for render, function as follows:
 * - ensure child is vnodes
 * - auto-wrap children array with Fragment
 */
function normalizeVNode(child: VNodeChild): VNode {
  if (isArray(child)) return createVNode(Fragment, null, child.slice())
  if (isObject(child)) return cloneIfMounted(child)
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
    if (shapeFlag & ShapeFlags.ELEMENT) {
      const slot = (children as any).default
      slot && normalizeChildren(vnode, slot())
      return
    } else {
      type = ShapeFlags.SLOTS_CHILDREN
      ;(children as RawSlots)._ctx = currentRenderingInstance
    }
  } else if (isFunction(children)) {
    type = ShapeFlags.SLOTS_CHILDREN
    children = { default: children, _ctx: currentRenderingInstance }
  } else {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
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

function cloneVNode<T>(vnode: VNode<T>, extraProps?: (Data & VNodeProps) | null): VNode<T> {
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

  const cloned: VNode<T> = {
    [VNodeInternals.IS_VNODE]: true,
    type: vnode.type,
    props: mergedProps,
    // official vue will deepCloneVNode children here, if in DEV mode
    children: children,
    component: vnode.component,

    el: vnode.el,
    anchor: vnode.anchor,
    key: mergedProps && normalizeKey(mergedProps),

    shapeFlag: vnode.shapeFlag,
    patchFlag: newPatchFlag,
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
  return child.el === null && child.patchFlag !== PatchFlags.HOISTED ? child : cloneVNode(child)
}

/* ==================== create impl ==================== */
function createBaseVNode(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null,
  children: unknown = null,
  shapeFlag: number,
  patchFlag: number,
  needFullChildrenNormalization = false
): VNode {
  const vnode = {
    [VNodeInternals.IS_VNODE]: true,
    type,
    props,
    children,
    component: null,

    el: null,
    anchor: null,
    key: props && normalizeKey(props),

    shapeFlag,
    patchFlag,
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

  return vnode
}

function createVNode(
  type: VNodeTypes,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  // provided when call, not auto-computed
  patchFlag: number = 0
) {
  // light: valid vnode guard, using COMMENT as a fallback type
  type = type || Comment

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

  // resolve shapeFlag
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
      ? ShapeFlags.STATEFUL_COMPONENT
      : isFunction(type)
        ? ShapeFlags.FUNCTIONAL_COMPONENT
        : // light: for special vnode types (e.g. Comment, Text, Fragment), shapeFlag = 0
          0

  return createBaseVNode(type, props, children, shapeFlag, patchFlag, true)
}

/* ==================== checks utils ==================== */
function isVNode(value: unknown): value is VNode {
  return value ? value[VNodeInternals.IS_VNODE] === true : false
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

export { normalizeVNode, cloneVNode, createVNode, isVNode, isSameVNodeType, invokeVNodeHook }
