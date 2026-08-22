import type { ReactiveEffect } from "@soppy-vue/reactivity"
import { proxyRefs, resetTracking, setTracking, track } from "@soppy-vue/reactivity"
import type { VNode, VNodeChild } from "../vnode"
import {
  publicInstanceProxyHandler,
  publicPropertiesMap,
  type ComponentPublicInstance,
} from "./publicInstance"
import type { IfAny } from "@soppy-vue/shared"
import { EMPTY_OBJ, isFunction, NOOP, ShapeFlags } from "@soppy-vue/shared"
import type { SchedulerJob } from "../scheduler"
import type { NormalizedPropsOptions } from "./props"
import { initProps, normalizePropsOptions } from "./props"
import type { ComponentOptions } from "./options"
import type { EmitFn, EmitsOptions, EmitsToProps, ObjectEmitsOptions } from "./emits"
import { emit, normalizeEmitsOptions } from "./emits"
import { setCurrentInstance, unsetCurrentInstance } from "./context"
import type { LifecycleHooks } from "../constant"
import type { InternalSlots, Slots, SlotsType, UnwrapSlotsType } from "./slots"
import { initSlots } from "./slots"

// used to accept non built-in information in `prop`
type Data = Record<string, unknown>

/* ==================== component define ==================== */
type Component<Props = any, RData = any, Emits extends EmitsOptions = {}> =
  // ComponentPublicInstanceConstructor is specific to defineComponent; omitted here for simplicity
  ConcreteComponent<Props, RData, Emits>

type ConcreteComponent<Props = {}, RData = any, Emits extends EmitsOptions = {}> =
  ComponentOptions<Props, RData, Emits> | FunctionalComponent<Props, Emits>

interface FunctionalComponent<
  Props = {},
  Emits extends EmitsOptions = {},
  S extends Record<string, any> = any,
> {
  (
    props: Props & EmitsToProps<Emits>,
    // only StatefulComponent have the `expose` functionality
    ctx: Omit<SetupContext<Emits, IfAny<S, {}, SlotsType<S>>>, "expose">
  ): any
  props?: any
  emits?: Emits | (keyof Emits)[]
  slots?: IfAny<S, Slots, SlotsType<S>>
}

/* ==================== internal instance ==================== */
type LifecycleHook<F = Function> = F[] | null

type SetupContext<Emits = EmitsOptions, S extends SlotsType = {}> = Emits extends any
  ? {
      attrs: Data
      emit: EmitFn<Emits>
      slots: UnwrapSlotsType<S>
      expose: (exposed: Record<string, any>) => void
    }
  : never

type InternalRenderFunction = {
  (
    ctx: ComponentPublicInstance,
    $props: ComponentInternalInstance["props"],
    $setup: ComponentInternalInstance["setupState"],
    $data: ComponentInternalInstance["data"],
    $options: ComponentInternalInstance["ctx"]
  ): VNodeChild
}

interface ComponentInternalInstance {
  uid: number
  type: ConcreteComponent

  /* ===== vnode relations ==================== */
  vnode: VNode
  subTree: VNode
  next: VNode | null

  /* ===== comp tree relations ==================== */
  root: ComponentInternalInstance
  parent: ComponentInternalInstance | null

  /* ===== options schema ==================== */
  /**
   * store normalized props definition & a list of keys requiring special casting (Boolean/default).
   * used by the instance to resolve and validate props in `initProps` & `updateProps`.
   * @example Validation
   * props: { count: { type: Number, required: true } }
   * <comp :count="'10'" /> => warns
   * @example Default
   * props: { pageSize: { type: Number, default: 10 } }
   * <comp /> => { props: { pageSize: 10 } }
   * @example Casting^skip
   * props: { boolProp: Boolean }
   * <comp boolProp> => { props: { boolProp: true } }
   */
  propsOptions: NormalizedPropsOptions
  emitsOptions: ObjectEmitsOptions | null

  /* ===== state ==================== */
  data: Data
  attrs: Data
  attrsProxy: Data | null
  props: Data
  propsDefaults: Data

  /* ===== communication ==================== */
  emit: EmitFn
  slots: InternalSlots

  /* ===== effect ==================== */
  update: SchedulerJob
  effect: ReactiveEffect

  /* ===== render context ==================== */
  /**
   * light: internal ctx backing `instance.proxy`,
   * typed loosely to hide internals
   */
  ctx: Data
  proxy: ComponentPublicInstance | null

  /* ===== render fn ==================== */
  setupState: Data
  setupContext: SetupContext | null
  render: InternalRenderFunction | null

  /* ===== stateful comp expose ==================== */
  exposed: Record<string, any> | null
  exposeProxy: Record<string, any> | null

  /* ===== lifecycle hooks ==================== */
  isMounted: boolean
  isUnmounted: boolean

  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook
  [LifecycleHooks.MOUNTED]: LifecycleHook
  [LifecycleHooks.BEFORE_UNMOUNT]: LifecycleHook
  [LifecycleHooks.UNMOUNTED]: LifecycleHook
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook
  [LifecycleHooks.UPDATED]: LifecycleHook
}

export type {
  Data,
  Component,
  ConcreteComponent,
  ComponentOptions,
  FunctionalComponent,
  SetupContext,
  ComponentInternalInstance,
}

let uid = 0

function createComponentInstance(vnode: VNode, parent: ComponentInternalInstance | null) {
  const type = vnode.type as ConcreteComponent
  // light: use non-null assertion to skip initial checks
  const instance: ComponentInternalInstance = {
    uid: uid++,
    type,

    vnode,
    subTree: null!,
    next: null,

    root: null!,
    parent,

    propsOptions: normalizePropsOptions(type),
    emitsOptions: normalizeEmitsOptions(type),

    data: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    attrsProxy: null,
    props: EMPTY_OBJ,
    propsDefaults: EMPTY_OBJ,

    emit: null!,
    slots: EMPTY_OBJ,

    update: null!,
    effect: null!,

    ctx: EMPTY_OBJ,
    proxy: null,

    setupState: null!,
    setupContext: null,
    render: null,

    exposed: null,
    exposeProxy: null,

    isMounted: false,
    isUnmounted: false,

    beforeMount: null,
    mounted: null,
    beforeUnmount: null,
    unmounted: null,
    beforeUpdate: null,
    updated: null,
  }

  instance.ctx = { _: instance }
  instance.root = parent ? parent.root : instance
  instance.emit = emit.bind(null, instance)

  return instance
}

function isStatefulComponent(instance: ComponentInternalInstance) {
  return !!(instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT)
}

function getAttrsProxy(instance: ComponentInternalInstance): Data {
  return (
    instance.attrsProxy ||
    (instance.attrsProxy = new Proxy(instance.attrs, {
      get(target, key: string) {
        track(instance, "$attrs")
        return target[key]
      },
    }))
  )
}

function createSetupContext(instance: ComponentInternalInstance): SetupContext {
  const expose: SetupContext["expose"] = (exposed) => {
    instance.exposed = exposed || {}
  }

  return {
    get attrs() {
      return getAttrsProxy(instance)
    },
    slots: instance.slots,
    emit: instance.emit,
    expose,
  }
}

/**
 * official vue3 splits instance creation from initialization, allowing
 * compat components to bypass `setupComponent` via `compatMountInstance`
 * **our mini-build** skips the compat implementation but keeps the branches structure
 */
function setupComponent(instance: ComponentInternalInstance) {
  const { props, children } = instance.vnode
  const isStateful = isStatefulComponent(instance)

  initProps(instance, props, isStateful)
  initSlots(instance, children)

  const setupResult = isStateful ? setupStatefulComponent(instance) : undefined
  return setupResult
}

function setupStatefulComponent(instance: ComponentInternalInstance) {
  // breaking point: ComponentOptions is type specific to stateful components
  const Component = instance.type as ComponentOptions

  // create publicInstance via Proxy
  instance.proxy = new Proxy(instance.ctx, publicInstanceProxyHandler)

  // call `setup()` only once at first mount
  const { setup } = Component
  if (setup) {
    /**
     * light: skip creating setupContext when setup function didnt declare formal param, to avoid
     * unnecessary object allocation and enables fast path
     */
    const setupContext = (instance.setupContext =
      // function.length indicates the number of parameters
      setup.length > 1 ? createSetupContext(instance) : null)

    // light: enable getCurrentInstance, disable track in `setup`
    setCurrentInstance(instance)
    setTracking(false)

    // light: the non-null assertion is safe!
    const setupResult = setup(instance.props, setupContext!)

    resetTracking()
    unsetCurrentInstance()

    // skip handling async setup: not recommended by vue3.4
    handleSetupResult(instance, setupResult)
  }

  finishComponentSetup(instance)
}

function handleSetupResult(instance: ComponentInternalInstance, setupResult: unknown) {
  if (isFunction(setupResult)) {
    /**
     * case 1: `setup` return a render function
     * @example
     * setup() { return () => createVNode("div", {}, "eg") }
     */
    instance.render = setupResult as InternalRenderFunction
  } else {
    /**
     * case 2: `setup` return a state object
     * @example
     * setup() { return { count: ref(0) } }
     */
    instance.setupState = proxyRefs(setupResult)
  }
}

function finishComponentSetup(instance: ComponentInternalInstance) {
  const Component = instance.type as ComponentOptions

  if (!instance.render) {
    /**
     * in origin vue3, component registered at runtime (e.g. via `app.component()`) may
     * carry only a `template` without pre-compiled renderFn, vue would compile it on the fly:
     * @example
     * ```js
     * app.component('MyComp', { template: `<div>{{ msg }}</div>` })
     * ```
     * our implementation doesn't take this scenario into account
     */
    instance.render = (Component.render || NOOP) as InternalRenderFunction
  }
}

/* ==================== expose utils ==================== */
function getExposeProxy(instance: ComponentInternalInstance) {
  if (!instance.exposed) return
  return (
    instance.exposeProxy ||
    (instance.exposeProxy = new Proxy(proxyRefs(instance.exposed), {
      // exclude keys of symbol
      get(target, key: string) {
        if (key in target) {
          return target[key]
        } else if (key in publicPropertiesMap) {
          return publicPropertiesMap[key](instance)
        }
      },
      has(target, key) {
        return key in target || key in publicPropertiesMap
      },
    }))
  )
}

export { createComponentInstance, setupComponent, isStatefulComponent, getExposeProxy }
