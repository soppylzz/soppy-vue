/**
 * @module Transition
 * note: since `Transition` is coupled with `HTMLElement`, it needs
 * to be placed in `@soppy-vue/runtime-dom`. coupling below:
 * - class injection impl (e.g. {@link ElementWithTransition})
 */
import type { BaseTransitionProps, FunctionalComponent } from "@soppy-vue/runtime-core"
import { BaseTransition, createVNode } from "@soppy-vue/runtime-core"
import type { MaybeArray } from "@soppy-vue/shared"
import { ensureArray, extend, isObject, syncRunFns, toNumber } from "@soppy-vue/shared"
import { TransitionFlags } from "../constants"

interface TransitionTarget {
  [TransitionFlags.CLASS]?: Set<string>
  [TransitionFlags.END_ID]?: number
  [TransitionFlags.IS_LEAVING]?: boolean
}

export type { TransitionTarget }

/* ==================== base utils ==================== */
const normalizeDuration = (duration: TransitionProps["duration"]): [number, number] => {
  return isObject(duration) ? [toNumber(duration.enter), toNumber(duration.leave)] : [1000, 1000]
}

const invokeHook = (hooks?: MaybeArray<Function>, args: any[] = []) =>
  hooks && syncRunFns(ensureArray(hooks), args)

/**
 * rename: `hasExplicitCallback` -> `hasCustomizedDoneHook`
 * determine has user customized hooks, which has 2 args, in
 * provided hook
 */
const hasCustomizedDoneHook = (hook?: MaybeArray<Function>) =>
  !!hook && ensureArray(hook).some((fn) => fn.length > 1)

/* ==================== frame utils ==================== */
const nextFrame = (cb: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb)
  })
}

let endId = 0
const whenTransitionEnds = (
  el: Element & TransitionTarget,
  timeout: number,
  resolve: () => void
) => {
  const id = (el[TransitionFlags.END_ID] = ++endId)
  return setTimeout(() => {
    if (id === el[TransitionFlags.END_ID]) resolve()
  }, timeout)
}

/* ==================== class utils ==================== */
const addTransitionClass = (el: Element & TransitionTarget, cls: string) => {
  // "foo bar" => classList: ["foo", "bar"], \s means space
  cls.split(/\s+/).forEach((c) => c && el.classList.add(c))
  ;(el[TransitionFlags.CLASS] || (el[TransitionFlags.CLASS] = new Set())).add(cls)
}

const removeTransitionClass = (el: Element & TransitionTarget, cls: string) => {
  cls.split(/\s+/).forEach((c) => c && el.classList.remove(c))
  const addedClasses = el[TransitionFlags.CLASS]
  if (!addedClasses) return

  addedClasses.delete(cls)
  // light: free Set memory here
  !addedClasses.size && (el[TransitionFlags.CLASS] = undefined)
}

/* ==================== Transition impl ==================== */
interface TransitionProps extends BaseTransitionProps {
  name?: string
  /**
   * self-design: narrow type range, must explicitly specify
   * `duration` to skip auto-generated timeout process in
   * official vue
   */
  duration: { enter: number; leave: number }

  // origin comment: custom transition classes
  enterFromClass?: string
  enterActiveClass?: string
  enterToClass?: string

  leaveFromClass?: string
  leaveActiveClass?: string
  leaveToClass?: string
  /* =============== not-impl =============== */
  /**
   * - appear & appear hooks: not planning to impl them
   * - type: "transition" | "animation"
   *   specify css anime property that we concern on
   */
}

const DOMTransitionPropsValidators = {
  name: String,
  duration: Object,

  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,

  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String,
}

function resolveTransitionProps(rawProps: TransitionProps): BaseTransitionProps<Element> {
  // prepare: extract BaseTransition props
  const baseProps: BaseTransitionProps<Element> = {}
  for (const key in rawProps) {
    if (key in DOMTransitionPropsValidators) continue
    ;(baseProps as any)[key] = (rawProps as any)[key]
  }

  const {
    name = "v",
    duration,

    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,

    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
  } = rawProps

  const [enterDuration, leaveDuration] = normalizeDuration(duration)!
  const { onBeforeEnter, onEnter, onLeave, onEnterCancelled, onLeaveCancelled } = baseProps

  const finishEnter = (el: Element, done?: () => void) => {
    removeTransitionClass(el, enterToClass)
    removeTransitionClass(el, enterActiveClass)
    done?.()
  }
  const finishLeave = (el: Element & TransitionTarget, done?: () => void) => {
    el[TransitionFlags.IS_LEAVING] = false

    removeTransitionClass(el, leaveFromClass)
    removeTransitionClass(el, leaveToClass)
    removeTransitionClass(el, leaveActiveClass)
    done?.()
  }

  return extend(baseProps, {
    onBeforeEnter(el) {
      invokeHook(onBeforeEnter, [el])
      addTransitionClass(el, enterFromClass)
      addTransitionClass(el, enterActiveClass)
    },

    onEnter(el, done) {
      const resolve = () => finishEnter(el, done)

      invokeHook(onEnter, [el, resolve])

      nextFrame(() => {
        removeTransitionClass(el, enterFromClass)
        addTransitionClass(el, enterToClass)

        if (!hasCustomizedDoneHook(onEnter)) {
          whenTransitionEnds(el, enterDuration, resolve)
        }
      })
    },

    onLeave(el: Element & TransitionTarget, done) {
      el[TransitionFlags.IS_LEAVING] = true
      const resolve = () => finishLeave(el, done)

      addTransitionClass(el, leaveFromClass)
      // ligth: force reflow
      void document.body.offsetHeight
      addTransitionClass(el, leaveActiveClass)

      nextFrame(() => {
        if (!el[TransitionFlags.IS_LEAVING]) return

        removeTransitionClass(el, leaveFromClass)
        addTransitionClass(el, leaveToClass)

        if (!hasCustomizedDoneHook(onLeave)) {
          whenTransitionEnds(el, leaveDuration, resolve)
        }
      })

      invokeHook(onLeave, [el, resolve])
    },

    onEnterCancelled(el) {
      finishEnter(el)
      invokeHook(onEnterCancelled, [el])
    },

    onLeaveCancelled(el) {
      finishLeave(el)
      invokeHook(onLeaveCancelled, [el])
    },
  } as BaseTransitionProps<Element>)
}

const Transition: FunctionalComponent<TransitionProps> = (props, { slots }) =>
  createVNode(BaseTransition, resolveTransitionProps(props) as unknown as any, slots)

export type { TransitionProps }
export { Transition }
