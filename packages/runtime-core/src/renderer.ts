import {
  EMPTY_ARR,
  EMPTY_OBJ,
  isArray,
  isReservedProp,
  PatchFlags,
  ShapeFlags,
  syncRunFns,
} from "@soppy-vue/shared"
import type { VNode, VNodeArrayChildren, VNodeKey } from "./vnode"
import {
  cloneIfMounted,
  Fragment,
  invokeVNodeHook,
  isSameVNodeType,
  normalizeVNode,
  Text,
} from "./vnode"
import type {
  ComponentInternalInstance,
  Data,
  KeepAliveContext,
  TransitionHooks,
  TeleportImpl,
} from "./component"
import {
  createComponentInstance,
  setupComponent,
  updateProps,
  renderComponentRoot,
  shouldUpdateComponent,
  updateHOCHostEl,
  updateSlots,
  isKeepAlive,
} from "./component"
import { ReactiveEffect, resetTracking, setTracking } from "@soppy-vue/reactivity"
import type { SchedulerJob } from "./scheduler"
import {
  flushPostFlushCbs,
  flushPreFlushCbs,
  invalidateJob,
  queueJob,
  queuePostFlushCbs,
} from "./scheduler"
import { lis } from "./lis"
import { LifecycleHooks, MoveTypes, TeleportMoveTypes } from "./constant"

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
  createComment(text: string): HostNode
  setText(node: HostNode, text: string): void

  // in DOM tree, leafs can be accepted by Element/Node, non-leafs must be Element
  parentNode(node: HostNode): HostElement | null
  nextSibling(node: HostNode): HostNode | null

  // support teleport to find where target is
  querySelector(selector: string): HostElement | null
}

/**
 * --- why is the "Root" prefix used here? ---
 *
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

export type { Renderer, RendererOptions, RendererNode, RendererElement, RootRenderFunction }

/* ==================== render internals ==================== */
interface RendererInternals<HostNode = RendererNode, HostElement = RendererElement> {
  patch: (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor?: RendererNode | null,
    parentComponent?: ComponentInternalInstance | null,
    /**
     * light: set to optional, automatically inferred
     * internally via `n2.dynamicChildren`
     */
    optimized?: boolean
  ) => void
  unmount: (
    vnode: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => void
  remove: (vnode: VNode) => void
  move: (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    moveType: MoveTypes
  ) => void
  mountComponent: (
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null
  ) => void
  mountChildren: (
    children: VNodeArrayChildren,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean,
    start?: number
  ) => void
  patchChildren: (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => void
  next: (vnode: VNode) => RendererNode | null
  // block render support
  patchBlockChildren: (
    fc1: VNode[],
    fc2: VNode[],
    fallbackContainer: RendererElement,
    parentComponent: ComponentInternalInstance | null
  ) => void
  options: RendererOptions<HostNode, HostElement>
}

export type { RendererInternals }

/* ==================== render utils ==================== */
function toggleRecurse({ effect, update }: ComponentInternalInstance, allowed: boolean) {
  // update ReactiveEffect.allowRecurse / ScheduleJob.allowRecurse at once
  effect.allowRecurse = update.allowRecurse = allowed
}

function needTransition(transition: TransitionHooks | null) {
  /**
   * origin implement with not considering suspense: `transition && !transition.persisted`
   * omit handling persisted, as there is no place in our impl where `persisted` is consumed
   */
  return !!transition
}

function traverseStaticChildren(n1: VNode, n2: VNode, deep: boolean) {
  const c1 = n1.children
  const c2 = n2.children

  if (isArray(c1) && isArray(c2)) {
    for (let i = 0; i < c1.length; i++) {
      const oldVNode = c1[i] as VNode
      let newVNode = c2[i] as VNode

      if (newVNode.shapeFlag & ShapeFlags.ELEMENT && !newVNode.dynamicChildren) {
        if (newVNode.patchFlag <= 0) {
          newVNode = c2[i] = cloneIfMounted(c2[i] as VNode)
          newVNode.el = oldVNode.el
        }
        // recursive traversal
        deep && traverseStaticChildren(oldVNode, newVNode, true)
      }

      if (newVNode.type === Text) {
        newVNode.el = oldVNode.el
      }
    }
  }
}

/* ==================== render creator ==================== */
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
    createComment: hostCreateComment,
    createText: hostCreateText,
    setElementText: hostSetElementText,
    setText: hostSetText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    patchProp: hostPatchProp,
  } = options

  /* ==================== internal methods (utils) ==================== */
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

  const getNextHostNode: RendererInternals["next"] = (vnode: VNode): RendererNode | null => {
    if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
      return getNextHostNode(vnode.component!.subTree)
    }
    // Fragment use anchor as boundary, single-root nodes use el as boundary
    return hostNextSibling((vnode.anchor || vnode.el)!)
  }

  /* ==================== internal methods (main) ==================== */
  const patch: RendererInternals["patch"] = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
    optimized = !!n2.dynamicChildren
  ) => {
    // vnode remain unchanged, skip
    if (n1 === n2) return

    // type change, unmount old tree and re-mount as new
    if (n1 && !isSameVNodeType(n1, n2)) {
      /**
       * light: anchor arrives as `null`, but the re-mount `hostInsert` places the new
       * node **before** the anchor, so it must point at the node **after** the old vnode
       * to land in the same spot
       */
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, true)
      n1 = null
    }

    const { type, shapeFlag, patchFlag } = n2

    if (patchFlag === PatchFlags.BAIL) {
      optimized = false
      n2.dynamicChildren = null
    }
    /**
     * synchronize the changes to VNodeTypes with case-statement here,
     * to enable the rendering of certain special vnode, like:
     * - `Comment`, `Static`, **`Fragment`**
     */
    switch (type) {
      /**
       * light: at first, i thought it was a unnecessary impl, but during development,
       * i discovered it is often used as a fallback vnode type within runtime
       */
      case Comment: {
        processComment(n1, n2, container, anchor)
        break
      }
      case Text: {
        processText(n1, n2, container, anchor)
        break
      }
      case Fragment: {
        processFragment(n1, n2, container, anchor, parentComponent, optimized)
        break
      }
      default: {
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor, parentComponent, optimized)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(n1, n2, container, anchor, parentComponent)
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          ;(type as typeof TeleportImpl).patch(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            optimized,
            internals
          )
        }
        // in DEV mode, issue a warning if not matching
      }
    }
  }

  const remove: RendererInternals["remove"] = (vnode) => {
    const { type, el, anchor, transition, shapeFlag } = vnode

    if (type === Fragment) {
      /**
       * Fragment VNode anchors:
       * - `el`: leading empty text node (before first child)
       * - `anchor`: trailing empty text node (after last child)
       *
       * removal strategy (official vue3):
       * - prod: direct DOM removal in a loop — minimal overhead.
       * - dev:  remove via vnode.children — poor stability.
       */
      let cur = el!
      const end = anchor!

      let next
      while (cur !== end) {
        next = hostNextSibling(cur)!
        hostRemove(cur)
        cur = next
      }
      hostRemove(end)
    }

    const remove_ = () => {
      hostRemove(el!)
      transition?.afterLeave?.()
    }

    /**
     * light: customize pre-remove process here
     * for transition implementation
     */
    if (shapeFlag & ShapeFlags.ELEMENT && transition) {
      const { leave, delayLeave } = transition
      const performLeave = () => leave(el!, remove_)

      if (delayLeave) {
        delayLeave(vnode.el!, remove_, performLeave)
      } else {
        performLeave()
      }
    } else {
      remove_()
    }
  }

  const move: RendererInternals["move"] = (
    vnode,
    container,
    anchor,
    // consumed by transition
    moveType
  ) => {
    const { type, el, shapeFlag, children, transition } = vnode

    if (type === Fragment) {
      // move start text node
      hostInsert(el!, container, anchor)
      for (let i = 0; i < (children as VNode[]).length; i++) {
        move((children as VNode[])[i], container, anchor, moveType)
      }
      // move end text node
      hostInsert(vnode.anchor!, container, anchor)
      return
    }

    if (shapeFlag & ShapeFlags.TELEPORT) {
      ;(type as typeof TeleportImpl).move(
        vnode,
        container,
        anchor,
        internals,
        TeleportMoveTypes.REORDER /* pass explicitly */
      )
      return
    }

    if (shapeFlag & ShapeFlags.COMPONENT) {
      move(vnode.component!.subTree, container, anchor, moveType)
      return
    }

    // do speicial move for transition component
    const doSpecialTransition =
      transition &&
      shapeFlag & ShapeFlags.ELEMENT && // handle element only
      moveType & (MoveTypes.ENTER | MoveTypes.LEAVE) // handle keep alive

    // light: el.insertBefore can handle moving existing DOM elements
    const remove = () => hostInsert(el!, container, anchor)

    if (doSpecialTransition) {
      if (moveType & MoveTypes.ENTER) {
        transition!.beforeEnter(el!)
        hostInsert(el!, container, anchor)
        queuePostFlushCbs(() => {
          transition!.enter(el!)
        })
      }
      if (moveType & MoveTypes.LEAVE) {
        const { leave, delayLeave, afterLeave } = transition!

        const performLeave = () => {
          leave(el!, () => {
            remove()
            afterLeave?.()
          })
        }

        if (delayLeave) {
          delayLeave(el!, remove, performLeave)
        } else {
          performLeave()
        }
      }
    } else {
      remove()
    }
  }

  const unmount: RendererInternals["unmount"] = (vnode, parentComponent, optimized) => {
    const { type, shapeFlag, children, dynamicChildren, patchFlag } = vnode

    if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
      // light: the specific unmount logic is in `ctx.deactivate` [KEEP_ALIVE].
      ;(parentComponent!.ctx as KeepAliveContext).deactivate(vnode)
      return
    }

    invokeVNodeHook("onVNodeBeforeUnmount", vnode)
    /**
     * in official vue3, parentComponent used for:
     * - support for implementation of keep-alive API
     * - pass component instance to the recursive call tree
     */
    if (shapeFlag & ShapeFlags.COMPONENT) {
      // process the component separately
      unmountComponent(vnode.component!)
    } else {
      if (shapeFlag & ShapeFlags.TELEPORT) {
        ;(vnode.type as typeof TeleportImpl).remove(vnode, parentComponent, internals)
      }

      // add fragment unmount optimization
      if (
        dynamicChildren &&
        (type !== Fragment || (patchFlag && patchFlag & PatchFlags.STABLE_FRAGMENT))
      ) {
        // unmount stable fragment
        unmountChildren(dynamicChildren, parentComponent, true)
      }

      if (
        (type === Fragment &&
          patchFlag & (PatchFlags.KEYED_FRAGMENT | PatchFlags.UNKEYED_FRAGMENT)) ||
        (!optimized && shapeFlag & ShapeFlags.ARRAY_CHILDREN)
      ) {
        // unmount keyed/unkeyed fragment
        unmountChildren(children as VNode[], parentComponent, false)
      }

      // all types of vnodes should eventually be deleted
      remove(vnode)
    }
    queuePostFlushCbs(() => invokeVNodeHook("onVNodeUnmounted", vnode))
  }

  /* ==================== internal methods (comment) ==================== */
  const processComment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null
  ) => {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateComment((n2.children as string) || "")), container, anchor)
    } else {
      // vue does not support for dynamic comments
      n2.el = n1.el
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
  const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    // light: save startAnchor to `vnode.el`, save endAnchor to `vnode.anchor` to fix the range
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(""))!
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(""))!

    const { patchFlag, dynamicChildren } = n2

    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)

      mountChildren(
        n2.children as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent,
        optimized
      )
    } else {
      if (
        patchFlag > 0 &&
        dynamicChildren &&
        n1.dynamicChildren &&
        patchFlag & PatchFlags.STABLE_FRAGMENT
      ) {
        /**
         * light: since `dynamicChildren` are collected at creation time and the fragment's
         * stable structure is guaranteed at compile time (no KEYED/UNKEYED), we can
         * safely skip full children diff and patch only dynamic vnodes by index.
         */
        patchBlockChildren(n1.dynamicChildren, dynamicChildren, container, parentComponent)

        /**
         * --- why does `traverseStaticChildren` always come after `patchBlockChildren`? ---
         * [ANSWER]
         */
        if (__DEV__) {
          traverseStaticChildren(n1, n2, true /* deep */)
        } else if (n2.key != null || (parentComponent && n2 === parentComponent.subTree)) {
          traverseStaticChildren(n1, n2, false /* shallow */)
        }
      } else {
        // process KEYED / UNKEYED, or manual fragment here, via full diff algorithm
        patchChildren(n1, n2, container, fragmentEndAnchor, parentComponent, optimized)
      }
    }
  }

  /* ==================== internal methods (element) ==================== */
  const mountElement = (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    // for array children process
    optimized: boolean
  ) => {
    const { props, shapeFlag, transition } = vnode
    const el: RendererElement = (vnode.el = hostCreateElement(vnode.type as string))

    /**
     * origin comment:
     * mount children first, since some props may rely on child content
     * being already rendered, e.g. `<select value>`
     */
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      mountChildren(vnode.children as VNodeArrayChildren, el, anchor, parentComponent, optimized)
    }

    if (props) {
      for (const key in props) {
        if (key !== "value" && !isReservedProp(key)) {
          hostPatchProp(el, key, null, props[key])
        }
      }
      // fix: wrong end process
      /**
       * --- why we patch DOM value at the end? ---
       * because value depends on other attrs (e.g. min/max) being set first.
       * @example
       * <template>
       *   <input type="range" :min="0" :max="100" :value="50" />
       * </template>
       */
      if ("value" in props) {
        hostPatchProp(el, "value", null, props.value)
      }
      invokeVNodeHook("onVNodeBeforeMount", vnode)
    }

    const doTransition = needTransition(transition)
    doTransition && transition!.beforeEnter(el)

    hostInsert(el, container, anchor)
    queuePostFlushCbs(() => {
      invokeVNodeHook("onVNodeMounted", vnode)
      doTransition && transition!.enter(el)
    })
  }

  const patchElement = (
    n1: VNode,
    n2: VNode,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    // as a vnode awaiting rendering, `n2.el` is not bound to an actual DOM element. reuse `n1.el` here
    const el = (n2.el = n1.el!)
    const { patchFlag, dynamicChildren } = n2

    const oldProps = n1.props || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ

    parentComponent && toggleRecurse(parentComponent, false)
    invokeVNodeHook("onVNodeBeforeUpdate", n2, n1)
    parentComponent && toggleRecurse(parentComponent, true)

    // 1. patch children
    if (dynamicChildren) {
      patchBlockChildren(n1.dynamicChildren!, dynamicChildren, el, parentComponent)
      __DEV__ && traverseStaticChildren(n1, n2, true /* deep */)
    } else if (!optimized) {
      patchChildren(n1, n2, el, null, parentComponent, false)
    }

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
         * not-impl: handle `patchFlag & PatchFlags.PROPS`, indicates
         * update dynamic props by certain `n2.dynamicProps`.
         */
      }

      // 2.2. patch element text
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children as string)
        }
      }
    } else {
      // 3. unmatching fallback
      if (!optimized && dynamicChildren == null) {
        // origin comment: unoptimized, full diff
        patchProps(el, oldProps, newProps)
      }
    }

    queuePostFlushCbs(() => invokeVNodeHook("onVNodeUpdated", n2, n1))
  }

  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    n1 == null
      ? mountElement(n2, container, anchor, parentComponent, optimized)
      : patchElement(n1, n2, parentComponent, optimized)
  }

  /* ==================== internal methods (component) ==================== */
  /**
   * fast-path when a parent update triggers a child re-render.
   * - copy instance
   * - syncs props
   * - flushes all pre-render callbacks
   * before the component's render effect re-runs.
   */
  const updateComponentPreRender = (instance: ComponentInternalInstance, next: VNode) => {
    next.component = instance
    const prevProps = instance.vnode.props
    instance.vnode = next
    /**
     * light: updateComponentPreRender executing when `next` existed,
     * we only **CONSUME** `next` once, and clear it immediately.
     *
     * `next` will be reset the next time `shouldUpdateComponent=true`
     * in {@link updateComponent} is executed
     */
    instance.next = null

    /**
     * self-design: skip compile-time optimization
     * for details; only optimize vnode patch
     */
    updateProps(instance, next.props, prevProps)
    updateSlots(instance, next.children)

    setTracking(false)
    /**
     * vue api cause flush below:
     * - watcher with { flush: "pre" }
     * - onBeforeUpdate
     */
    flushPreFlushCbs(instance)
    resetTracking()
  }

  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: RendererElement,
    anchor: RendererNode | null
  ) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const { beforeMount, mounted } = instance

        toggleRecurse(instance, false)
        beforeMount && syncRunFns(beforeMount)
        invokeVNodeHook("onVNodeBeforeMount", initialVNode)
        toggleRecurse(instance, true)

        const subTree = (instance.subTree = renderComponentRoot(instance))

        patch(null, subTree, container, anchor, instance)
        initialVNode.el = subTree.el

        mounted && queuePostFlushCbs(mounted)
        queuePostFlushCbs(() => invokeVNodeHook("onVNodeMounted", initialVNode))

        instance.isMounted = true
        // origin issue#2458: deference mount-only object parameters to prevent memleaks
        initialVNode = container = anchor = null as any
      } else {
        // process update component
        const { vnode, beforeUpdate, updated } = instance
        let next = instance.next
        const originNext = next

        toggleRecurse(instance, false)
        if (next) {
          next.el = vnode.el
          // light: process pre-watcher
          updateComponentPreRender(instance, next)
        } else {
          next = vnode
        }
        beforeUpdate && syncRunFns(beforeUpdate)
        invokeVNodeHook("onVNodeBeforeUpdate", next, vnode)
        toggleRecurse(instance, true)

        const nextTree = renderComponentRoot(instance)
        const prevTree = instance.subTree
        instance.subTree = nextTree

        patch(
          prevTree,
          nextTree,
          hostParentNode(prevTree.el!)!,
          getNextHostNode(prevTree),
          instance
        )

        next.el = nextTree.el
        if (originNext === null) {
          /**
           * --- why use updateHOCHostEl to find ancestor node? ---
           */
          updateHOCHostEl(instance, nextTree.el)
        }

        updated && queuePostFlushCbs(updated)
        queuePostFlushCbs(() => invokeVNodeHook("onVNodeUpdated", next, vnode))
      }
    }

    const effect = (instance.effect = new ReactiveEffect(componentUpdateFn, () => queueJob(update)))

    const update: SchedulerJob = (instance.update = () => {
      if (effect.dirty) {
        effect.run()
      }
    })
    update.id = instance.uid
    toggleRecurse(instance, true)

    if (__DEV__) {
      const rtc = instance[LifecycleHooks.RENDER_TRACKED]
      const rtg = instance[LifecycleHooks.RENDER_TRIGGERED]
      effect.onTrack = rtc ? (e) => syncRunFns(rtc, e) : undefined
      effect.onTrigger = rtg ? (e) => syncRunFns(rtg, e) : undefined
      update.ownerInstance = instance
    }
    update()
  }

  const mountComponent: RendererInternals["mountComponent"] = (
    initialVNode,
    container,
    anchor,
    parentComponent
  ) => {
    const instance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent
    ))

    if (isKeepAlive(initialVNode)) {
      /**
       * light: provide DOM manipulation fn to `KeepAliveImpl`; both `mount`
       * and `unmount` are implemented internally. [KEEP_ALIVE].
       */
      ;(instance.ctx as KeepAliveContext).renderer = internals
    }

    setupComponent(instance)
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  const unmountComponent = (instance: ComponentInternalInstance) => {
    const { update, subTree, beforeUnmount, unmounted } = instance
    beforeUnmount && syncRunFns(beforeUnmount)

    if (update) {
      update.active = false
      /**
       * light: `optimized` in unmount is only used for
       * unmounting fragment, here, pass false
       */
      unmount(subTree, instance, false)
    }
    unmounted && queuePostFlushCbs(() => unmounted)
    queuePostFlushCbs(() => (instance.isUnmounted = true))
  }

  const updateComponent = (n1: VNode, n2: VNode) => {
    const instance = (n2.component = n1.component)!

    if (shouldUpdateComponent(n1, n2)) {
      instance.next = n2
      // remove an existing pending `instance.update` job, to prevent executed twice
      invalidateJob(instance.update)
      instance.effect.dirty = true
      instance.update()
    } else {
      // origin comment: no update needed. just copy over properties
      n2.el = n1.el
      instance.vnode = n2
    }
  }

  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null
  ) => {
    if (n1 == null) {
      if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
        // light: the specific mount logic is in `ctx.activate` [KEEP_ALIVE].
        ;(parentComponent!.ctx as KeepAliveContext).activate(n2, container, anchor)
      } else {
        mountComponent(n2, container, anchor, parentComponent)
      }
    } else {
      updateComponent(n1, n2)
    }
  }

  /* ==================== internal methods (children) ==================== */
  const mountChildren: RendererInternals["mountChildren"] = (
    children,
    container,
    anchor,
    parentComponent,
    optimized,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      /**
       * light: update origin children during noramlizing
       * optimized path here:
       * - skip fragment auto-wrapping and null checks
       * - `normalizeVNode` relies internally on `cloneIfMounted`
       *   to achieve reuse
       */
      const child = (children[i] = optimized
        ? cloneIfMounted(children[i] as VNode)
        : normalizeVNode(children[i]))
      patch(null, child, container, anchor, parentComponent, optimized)
    }
  }

  const unmountChildren = (
    children: VNode[],
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean,
    start: number = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent, optimized)
    }
  }

  /**
   * during a single rendering process, vue performs a DFS of the entire vnode tree:
   * - `patch` is responsible for driving the recursive traversal
   * - `patchChildren` handles the downstream logic of `patch`, specifically to handle `vnode.children`
   */
  const patchChildren: RendererInternals["patchChildren"] = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    optimized
  ) => {
    const c1 = n1 && n1.children
    const c2 = n2 && n2.children

    const { shapeFlag: prevShapeFlag = 0 } = n1 ?? {}
    const { shapeFlag, patchFlag } = n2

    // fast path
    if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
      patchKeyedChildren(
        c1 as VNode[],
        c2 as VNodeArrayChildren,
        container,
        anchor,
        parentComponent,
        optimized
      )
      return
    }
    if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
      // patchUnkeyedChildren is only used here
      patchUnkeyedChildren(
        c1 as VNode[],
        c2 as VNodeArrayChildren,
        container,
        anchor,
        parentComponent,
        optimized
      )
      return
    }

    // origin comment: 3 situation: text, array or no children
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 1. any to text
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[], parentComponent, false)
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
            parentComponent,
            optimized
          )
        } else {
          /**
           * 3. array to null
           * --- why do we unmount c1 without mounting c2? ---
           *
           * - `vnode.children` is typed as `VNodeNormalizedChildren`
           * - After excluding `VNode[]` and `string`, the only valid value is `null`
           * - Therefore, there are no new children to mount
           */
          unmountChildren(c1 as VNode[], parentComponent, true)
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 4. text to array or null, clear text before update
          hostSetElementText(container, "")
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // 4.1 text to array
          mountChildren(c2 as VNodeArrayChildren, container, anchor, parentComponent, optimized)
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
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
  ) => {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR

    const oldLength = c1.length
    const newLength = c2.length

    const commonLength = Math.min(oldLength, newLength)
    for (let i = 0; i < commonLength; i++) {
      patch(c1[i], normalizeVNode(c2[i]), container, null, parentComponent, optimized)
    }

    if (oldLength > newLength) {
      unmountChildren(c1, parentComponent, false, commonLength)
    } else {
      mountChildren(c2, container, anchor, parentComponent, optimized, commonLength)
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
    parentComponent: ComponentInternalInstance | null,
    optimized: boolean
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
      const child = (c2[s] = optimized ? cloneIfMounted(c2[s] as VNode) : normalizeVNode(c2[s]))
      if (isSameVNodeType(c1[s], child)) {
        patch(c1[s], child, container, null, parentComponent, optimized)
      } else {
        break
      }
    }
    while (e1 >= s && e2 >= s) {
      const child = (c2[e2] = optimized ? cloneIfMounted(c2[e2] as VNode) : normalizeVNode(c2[e2]))
      if (isSameVNodeType(c1[e1], child)) {
        patch(c1[e1], child, container, null, parentComponent, optimized)
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
          patch(
            null,
            (c2[i] = optimized ? cloneIfMounted(c2[i] as VNode) : normalizeVNode(c2[i])),
            container,
            anchor,
            parentComponent,
            optimized
          )
        }
      }
      return
    }

    // handle only unmount points
    if (s > e2) {
      if (e1 >= s) {
        for (i = s; i <= e1; i++) {
          unmount(c1[i], parentComponent, true)
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
      const child = (c2[i] = optimized ? cloneIfMounted(c2[i] as VNode) : normalizeVNode(c2[i]))
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
        unmount(prevChild, parentComponent, true)
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
        unmount(prevChild, parentComponent, true)
      } else {
        // `i + 1` helps distinguish the initial value of 0
        newIndexToOldIndexMap[newIndex - s2] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          maxNewIndexSoFar = newIndex
        } else {
          moved = true
        }
        patch(prevChild, c2[newIndex] as VNode, container, null, parentComponent, optimized)
        patched++
      }
    }

    // mount & move
    const sequence = moved ? lis(newIndexToOldIndexMap) : EMPTY_ARR

    j = sequence.length - 1
    for (i = toBePatched - 1; i >= 0; i--) {
      const nextIndex = s2 + i
      const nextChild = c2[nextIndex] as VNode
      const anchor = nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : parentAnchor

      if (newIndexToOldIndexMap[i] === 0) {
        patch(null, nextChild, container, anchor, parentComponent, optimized)
      } else if (moved) {
        if (j < 0 || i !== sequence[j]) {
          move(nextChild, container, anchor, MoveTypes.REORDER)
        } else {
          j--
        }
      }
    }
  }

  const patchBlockChildren: RendererInternals["patchBlockChildren"] = (
    /**
     * light: `fc1` & `fc2` are flatten dynamic children in
     * blocked vnode, they are all the same length.
     */
    fc1,
    fc2,
    fallbackContainer,
    parentComponent
  ) => {
    for (let i = 0; i < fc2.length; i++) {
      const oldVnode = fc1[i]
      const newVnode = fc2[i]

      const container =
        oldVnode.el &&
        (oldVnode.type === Fragment ||
          !isSameVNodeType(oldVnode, newVnode) ||
          oldVnode.shapeFlag & (ShapeFlags.COMPONENT | ShapeFlags.TELEPORT))
          ? hostParentNode(oldVnode.el)!
          : fallbackContainer

      patch(oldVnode, newVnode, container, null, parentComponent, true /* optimized */)
    }
  }

  /* ==================== exposed methods ==================== */
  const render: RootRenderFunction = (vnode, container) => {
    if (vnode == null) {
      container._vnode && unmount(container._vnode, null, false)
    } else {
      patch(container._vnode || null, vnode, container)
    }

    // handle preFlushCbs that are not handled within comp instance, as well as all postFlushCbs
    flushPreFlushCbs()
    flushPostFlushCbs()

    // bind a vnode to a real HostElement, enable bi-directional access
    container._vnode = vnode
  }

  // exposed for KeepAlive
  const internals: RendererInternals = {
    patch,
    unmount,
    remove,
    move,
    mountComponent,
    mountChildren,
    patchChildren,
    next: getNextHostNode,
    patchBlockChildren,
    options,
  }

  return { render }
}

function createRenderer<HostNode = RendererNode, HostElement = RendererElement>(
  options: RendererOptions<HostNode, HostElement>
) {
  return createBaseRenderer(options)
}

export { createRenderer, traverseStaticChildren }
