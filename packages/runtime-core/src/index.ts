/* ==================== api ==================== */
export {
  // normal
  ref,
  reactive,
  proxyRefs,
  computed,
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
export { watch, watchEffect } from "./apiWatch"

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
export {
  // expose for compiled sfc
  createBaseVNode,
  createVNode,
  cloneVNode,
  isVNode,
  Fragment,
  Text,
  Comment,
} from "./vnode"
export {
  toggleBlockTrack,
  openBlock,
  // expose for compiled sfc
  createBaseBlock,
  createBlock,
} from "./block"

export { createRenderer } from "./renderer"

/**
 * self-design: there is no need to provide the `h()`,
 * just use `createVNode()` directly.
 * // export { h } from "./h"
 */

/* ==================== types ==================== */
export type {
  Ref,
  ToRef,
  ToRefs,
  UnwrapRef,
  ShallowRef,
  ShallowReactive,
  UnwrapNestedRefs,
  ComputedRef,
  WritableComputedRef,
} from "@soppy-vue/reactivity"

export type {
  WatchHandler,
  WatchEffect,
  WatchSource,
  WatchCallback,
  OnCleanup,
  WatchEffectOptions,
  WatchOptions,
} from "./apiWatch"

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
