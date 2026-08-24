/* ==================== api ==================== */
export {
  // normal
  ref,
  reactive,
  proxyRefs,
  computed,
  watch,
  watchEffect,
  toRef,
  toRefs,
  isRef,
  isProxy,
  isReactive,
  isShallow,
  // advanced
  triggerRef,
  shallowRef,
  shallowReactive,
  toRaw,
  // effect
  effect,
  ReactiveEffect,
} from "@soppy-vue/reactivity"

export {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onBeforeUnmount,
  onUnmounted,
  onRenderTracked,
  onRenderTriggered,
} from "./apiLifecycle"

export { provide, inject } from "./apiInject"
export { nextTick, queuePostFlushCbs } from "./scheduler"

export {
  getCurrentInstance,
  // KeepAlive
  KeepAlive,
  onActivated,
  onDeactivated,
  // Transition
  useTransitionState,
  resolveTransitionHooks,
  injectTransitionHooks,
  getTransitionRawChildren,
  BaseTransition,
  BaseTransitionPropsValidators,
  // Teleport
  Teleport,
} from "./component"
export { createVNode, cloneVNode, isVNode, Fragment, Text, Comment } from "./vnode"

export { createRenderer } from "./renderer"

/* ==================== types ==================== */
export type {
  Ref,
  ToRef,
  ToRefs,
  UnwrapRef,
  ShallowRef,
  ShallowReactive,
  UnwrapNestedRefs,
  // not-impl-yet: type infra of `watch`/`computed` API
} from "@soppy-vue/reactivity"

export type { InjectionKey } from "./apiInject"

export type {
  // component
  Component,
  ConcreteComponent,
  FunctionalComponent,
  ComponentInternalInstance,
  SetupContext,
  // component options
  ComponentOptions,
  ComponentBaseOptions,
  RenderFunction,
  // public instance
  ComponentPublicInstance,
  // slots
  Slot,
  Slots,
  SlotsType,
  // props
  Prop,
  PropType,
  // KeepAlive
  KeepAliveContext,
  // Transition
  TransitionHooks,
  TransitionState,
  BaseTransitionProps,
  // Teleport
  TeleportProps,
} from "./component"

export type {
  VNode,
  VNodeChild,
  VNodeTypes,
  VNodeProps,
  VNodeArrayChildren,
  VNodeNormalizedChildren,
} from "./vnode"

export type {
  Renderer,
  RendererNode,
  RendererElement,
  RendererOptions,
  RootRenderFunction,
} from "./renderer"
