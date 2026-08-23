import type {
  ComponentInternalInstance,
  ComponentOptions,
  ConcreteComponent,
  RendererElement,
  RendererNode,
  VNode,
  VNodeProps,
} from "@soppy-vue/runtime-dom"
import {
  cloneVNode,
  getCurrentInstance,
  isVNode,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  queuePostFlushCbs,
} from "@soppy-vue/runtime-dom"
import type { ComponentRenderContext } from "../publicInstance"
import { LifecycleHooks, RuntimeFlags } from "../../constant"
import type { RendererInternals } from "../../renderer"
import { isArray, isRegExp, isString, ShapeFlags, syncRunFns } from "@soppy-vue/shared"
import { getComponentName } from "../component"
import type { VNodeKey } from "../../vnode"
import { invokeVNodeHook, isSameVNodeType } from "../../vnode"
import { currentInstance } from "../context"
import { injectHook } from "../../apiLifecycle"

interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals
  activate: (vnode: VNode, container: RendererElement, anchor: RendererNode | null) => void
  deactivate: (vnode: VNode) => void
}

type MatchPattern = string | RegExp | (string | RegExp)[]
interface KeepAliveProps {
  include?: MatchPattern
  exclude?: MatchPattern
  max?: number | string
}

type CacheKey = NonNullable<VNodeKey> | ConcreteComponent
type Cache = Map<CacheKey, VNode>
type Keys = Set<CacheKey>

/* ==================== keep-alive utils ==================== */
const isKeepAlive = (vnode: VNode): boolean => (vnode.type as any)[RuntimeFlags.IS_KEEP_ALIVE]

const matches = (pattern: MatchPattern, name: string): boolean => {
  let flag = false
  isArray(pattern) && (flag = pattern.some((p) => matches(p, name)))
  isString(pattern) && (flag = pattern.split(",").includes(name))
  isRegExp(pattern) && (flag = pattern.test(name))
  return flag
}

const resetShapeFlag = (vnode: VNode) => {
  // origin comment: bitwise operations to remove keep alive flags
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
}

/* ==================== keep-alive impl ==================== */
const KeepAliveImpl: ComponentOptions = {
  name: "KeepAlive",
  [RuntimeFlags.IS_KEEP_ALIVE]: true,

  props: {
    max: [String, Number],
    // TODO: should be watched, to prune cache in post scheduling stage
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
  },

  setup(props: KeepAliveProps, { slots }) {
    const instance = getCurrentInstance()!
    const sharedContext = instance.ctx as KeepAliveContext

    const {
      patch,
      move,
      unmount: _unmount,
      options: { createElement },
    } = sharedContext.renderer

    const storageContainer = createElement("div")
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: VNode | null = null

    // exposed for `createBaseRenderer` via `instance!.ctx`
    sharedContext.activate = (vnode, container, anchor) => {
      const instance = vnode.component!
      /**
       * light: move the cached vnode within the live DOM from
       * storageContainer
       */
      move(vnode, container, anchor)
      patch(instance.vnode, vnode, container, anchor, instance)

      queuePostFlushCbs(() => {
        instance.isDeactivated = false
        instance.activated && syncRunFns(instance.activated)
        invokeVNodeHook("onVNodeMounted", vnode)
      })
    }
    sharedContext.deactivate = (vnode: VNode) => {
      const instance = vnode.component!
      /**
       * light: move the vnode out of the live DOM into storageContainer,
       * keeping it alive for later re-activation.
       */
      move(vnode, storageContainer, null)

      queuePostFlushCbs(() => {
        instance.deactivated && syncRunFns(instance.deactivated)
        invokeVNodeHook("onVNodeUnmounted", vnode)
        instance.isDeactivated = true
      })
    }

    function unmount(vnode: VNode) {
      resetShapeFlag(vnode)
      _unmount(vnode, instance)
    }

    let pendingCacheKey: CacheKey | null = null
    const cacheSubtree = () => {
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, instance.subTree)
      }
    }

    onMounted(cacheSubtree)
    onUpdated(cacheSubtree)
    onBeforeUnmount(() => {
      cache.forEach((cached) => {
        const { subTree: vnode } = instance

        if (cached.type === vnode.type && cached.key === vnode.key) {
          resetShapeFlag(vnode)

          const deactivated = vnode.component![LifecycleHooks.ACTIVATED]
          deactivated && queuePostFlushCbs(deactivated)
          return
        }
        unmount(cached)
      })
    })

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key) as VNode
      if (!current || !isSameVNodeType(cached, current)) {
        unmount(cached)
      } else if (current) {
        resetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
    }

    return () => {
      pendingCacheKey = null
      if (!slots.default) return null
      const children = slots.default()
      let vnode = children[0]

      /* =============== pre-checks =============== */
      // slots returns multiple root nodes, return raw children directly
      if (children.length > 1) {
        current = null
        return children
      }

      // skip !vnode || !stateful || !suspense, ignored suspense process
      if (!isVNode(vnode) || !(vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT)) {
        current = null
        return vnode
      }

      const comp = vnode.type as ConcreteComponent
      const name = getComponentName(comp)

      const { include, exclude, max } = props

      // check name is matching include/exclude
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        return (current = vnode)
      }

      /* =============== render =============== */
      const key = vnode.key || comp
      const cachedVNode = cache.get(key)
      pendingCacheKey = key

      // is necessary below?
      if (vnode.el) {
        vnode = cloneVNode(vnode)
      }

      if (cachedVNode) {
        // reuse branch
        vnode.el = cachedVNode.el
        vnode.component = cachedVNode.component

        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
        keys.delete(key)
        keys.add(key)
      } else {
        // register branch
        keys.add(key)
        if (max && keys.size > parseInt(max as string, 10)) {
          /**
           * light: remove the oldest entry via `Set.prototype.values().next()`
           * this guard runs on every `Set.add()`, the overflow is at most 1, so
           * we just take the first iterator value directly instead of allocating
           * an array.
           *
           * @example
           * ```ts
           * const iteratorResult = (new Set([1, 2, 3])).values().next()
           * // { value: 1, done: false }
           * ```
           */
          pruneCacheEntry(keys.values().next().value!)
        }
      }

      // light: attach keep alive flag to avoid vnode being unmounted
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      return (current = vnode)
    }
  },
}

/**
 * light: public constructor signature exposed for h/jsx,
 * also to avoid inline import() in generated d.ts files
 *
 * @example
 * ```ts
 * const KeepAlive: typeof KeepAliveImpl = KeepAliveImpl
 * // will compiled to be:
 * const KeepAlive: import("../internal").KeepAliveImpl = KeepAliveImpl
 * ```
 */
const KeepAlive = KeepAliveImpl as unknown as {
  [RuntimeFlags.IS_KEEP_ALIVE]: true
  new (): { $props: VNodeProps & KeepAliveProps; $slots: { defafult(): VNode[] } }
}

/* ==================== keep-alive hooks ==================== */
function registerKeepAliveHook(
  hook: Function & { __keepAliveHook?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance
) {
  const wrappedHook =
    hook.__keepAliveHook ||
    (hook.__keepAliveHook = () => {
      let current = target
      /**
       * light: process nested KeepAlive, walk up the parent chain;
       * bail out if any ancestor Element has been marked as deactivated
       *
       * @example
       * ```vue
       * <KeepAlive>
       *   <KeepAlive>
       *     <Child/>
       *   </KeepAlive>
       * </KeepAlive>
       * ```
       */
      while (current) {
        if (current.isDeactivated) return
        current = current.parent
      }
      return hook()
    })
  // reuse apiLifecycle methods
  injectHook(type, wrappedHook, target)

  /**
   * light: inject hooks into ancestor KeepAlive roots upfront,
   * so activate/deactivate in `sharedContext` only iterates a
   * flat array instead of walking the subtree.
   */
  if (target) {
    const current: ComponentInternalInstance | null = target.parent
    while (current?.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        const keepAliveRoot = current

        // light: use a stack to execute hooks, ensuring FILO
        const injected = injectHook(type, hook, keepAliveRoot, true /* prepend */)

        onMounted(() => {
          const hooks = keepAliveRoot[type] as any[]
          const deleteIdx = hooks.indexOf(injected)
          deleteIdx >= 0 && hooks.splice(deleteIdx, 1)
        }, target)
      }
    }
  }
}

const onActivated = (hook: Function, target?: ComponentInternalInstance | null) =>
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target)
const onDeactivated = (hook: Function, target?: ComponentInternalInstance | null) =>
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target)

export type { KeepAliveContext }
export { isKeepAlive, KeepAlive, onActivated, onDeactivated }
