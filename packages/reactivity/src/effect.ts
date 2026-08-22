import { extend } from "@soppy-vue/shared"
import { DirtyLevels } from "./constants"
import type { Dep } from "./dep"

type EffectFunction = () => any
type EffectScheduler = (...args: unknown[]) => unknown

export type { EffectFunction }

/* ==================== effect infra (debug) ==================== */
type DebuggerEvent = {
  effect: ReactiveEffect
} & DebuggerEventExtraInfo

type DebuggerEventExtraInfo = {
  target: object
  key: any
  // only for debugging trigger
  newVal?: any
  oldVal?: any
}

export { DebuggerEvent }

/* ==================== effect infra ==================== */
let activeEffect: ReactiveEffect | null = null
function cleanDepEffect(dep: Dep, effect: ReactiveEffect) {
  dep.delete(effect)
  if (dep.size === 0) {
    dep.cleanup()
  }
}

// wrapper of effect function
class ReactiveEffect {
  // represent for effect.run() execute times
  _trackId = 0
  _running = 0

  _depsLength = 0
  deps: Dep[] = []

  active = true

  // support for computedRefImpl
  _dirtyLevel = DirtyLevels.DIRTY

  // __DEV__ only
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void

  // support for `extend(effect, {allowRecurse, scheduler})`
  allowRecurse?: boolean
  constructor(
    public fn: EffectFunction,
    public scheduler?: EffectScheduler
  ) {
    /**
     * @param fn effect function, which track execute in
     * @param scheduler schedule how to execute effect function
     */
  }

  get dirty() {
    return this._dirtyLevel === DirtyLevels.DIRTY
  }

  // quick update internal _dirtyLevel
  set dirty(v: boolean) {
    this._dirtyLevel = v ? DirtyLevels.DIRTY : DirtyLevels.NO_DIRTY
  }

  #preClean() {
    this._depsLength = 0
    this._trackId++
  }

  #postClean() {
    // STEP: 4. dependency cleanup
    if (this._depsLength < this.deps.length) {
      // trim stale deps
      for (let i = this._depsLength; i < this.deps.length; i++) {
        cleanDepEffect(this.deps[i], this)
      }
      this.deps.length = this._depsLength
    }
  }

  run() {
    this._dirtyLevel = DirtyLevels.NO_DIRTY

    // STEP: 3. effect execution
    if (!this.active) {
      return this.fn()
    }

    // light: use function call stack to manage effect history stack
    const lastEffect = activeEffect
    const lastShouldTrack = shouldTrack
    try {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      activeEffect = this

      // light: clean last collection via simple-diff algorithm
      this.#preClean()
      // light: avoid function call stack overflow
      this._running++
      return this.fn()
    } finally {
      this._running--
      this.#postClean()
      activeEffect = lastEffect
      shouldTrack = lastShouldTrack
    }
  }

  stop() {
    if (this.active) {
      this.#preClean()
      this.#postClean()
      this.active = false
    }
  }
}

export { activeEffect, ReactiveEffect }

/* ==================== create effect ==================== */
interface ReactiveEffectOptions {
  scheduler?: EffectScheduler
  // indicates whether track when **creating**
  lazy?: boolean
  // allow recurse, effect on triggerEffect
  allowRecurse?: boolean
}

interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

/**
 * standard way to create effectObj, characteristics:
 * - automatically collect deps when creating
 * - scheduler equivalent to effect function
 */
function effect(fn: EffectFunction, options?: ReactiveEffectOptions): ReactiveEffectRunner {
  const _effect = new ReactiveEffect(fn, () => {
    // ensure run in dirty
    _effect.dirty && _effect.run()
  })

  !options?.lazy && _effect.run()

  if (options) {
    // update runner.scheduler
    extend(_effect, options)
  }

  // return run(), which `this` point at effectObj
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

/* ==================== track effect ==================== */
// consumed in `track()`
let shouldTrack = true
let pauseScheduleStack = 0
const trackStack: boolean[] = []

/**
 * attention: merge official pauseTracking / enableTracking into this function;
 * unlike the scheduling fns defined below, these tracking fns are only used
 * outside of `reactivity`.
 */
function setTracking(enable: boolean) {
  trackStack.push(shouldTrack)
  shouldTrack = enable
}

function resetTracking() {
  const last = trackStack.pop()
  // track by default
  shouldTrack = last === undefined ? true : last
}

function trackEffect(
  effect: ReactiveEffect,
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  // skip multi-track for one dep in same execute of effect function
  if (dep.get(effect) === effect._trackId) return
  dep.set(effect, effect._trackId)

  /**
   * light: maintain deps using an in-place simple-diff algorithm.
   *
   * during `effect.run()`, deps are written sequentially starting from 0.
   * each track increments `effect._depsLength`, which represents the number of
   * deps collected in the current execution.
   *
   * by comparing the dep at the same index with the previous run, we can
   * detect whether a deps has changed (ignore been added, or removed).
   *
   * after all tracking is done, `effect._depsLength` is used to trim stale deps
   * in `effect.#postClean`.
   */
  const oldDep = effect.deps[effect._depsLength]
  if (oldDep !== dep) {
    if (oldDep) {
      cleanDepEffect(oldDep, effect)
    }
    effect.deps[effect._depsLength++] = dep
  } else {
    effect._depsLength++
  }

  __DEV__ && effect.onTrack?.(extend({ effect }, debuggerEventExtraInfo!))
}

export { shouldTrack, effect, trackEffect, setTracking, resetTracking }

/* ==================== trigger effect ==================== */
const queueEffectSchedulers: EffectScheduler[] = []

function pauseScheduling() {
  pauseScheduleStack++
}

function resetScheduling() {
  pauseScheduleStack--
  // light: ensure when handling **nested** schedules, executed only once at the end
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    queueEffectSchedulers.shift()!()
  }
}

function triggerEffects(dep: Dep, debuggerEventExtraInfo?: DebuggerEventExtraInfo) {
  pauseScheduling()
  for (const effect of dep.keys()) {
    if (!effect?.allowRecurse && !effect._running) continue

    if (effect._dirtyLevel < DirtyLevels.DIRTY) {
      effect._dirtyLevel = DirtyLevels.DIRTY
    }
    __DEV__ && effect.onTrigger?.(extend({ effect }, debuggerEventExtraInfo))

    // effect.trigger() // which we do not implement
    if (effect.scheduler) {
      // effect.scheduler() // deprcated: use queue to run
      queueEffectSchedulers.push(effect.scheduler)
    }
  }
  resetScheduling()
}

export { pauseScheduling, resetScheduling, triggerEffects }
