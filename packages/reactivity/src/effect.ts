import { DirtyLevels } from "./constants"
import type { Dep } from "./dep"

let activeEffect: ReactiveEffect | null = null

/**
 * effect function, general return:
 * - component structure
 * - computed value
 */
type EffectFunction = () => any
type EffectScheduler = (...args: unknown[]) => unknown

interface ReactiveEffectOptions {
  scheduler?: EffectScheduler
}

/**
 * wrapper of effect function
 */
class ReactiveEffect {
  // represent for effect.run() execute times
  _trackId = 0
  _running = 0

  _depsLength = 0
  deps: Dep[] = []

  active = true

  // support for computedRefImpl
  _dirtyLevel = DirtyLevels.DIRTY

  /**
   * @param fn effect function, which track execute in
   * @param scheduler schedule how to execute effect function
   */
  constructor(
    public fn: EffectFunction,
    public scheduler: EffectScheduler
  ) {}

  get dirty() {
    return this._dirtyLevel === DirtyLevels.DIRTY
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
    }
  }
}

/**
 * standard way to create effectObj, characteristics:
 * - automatically collect deps when creating
 * - scheduler equivalent to effect function
 */
function effect(fn: EffectFunction, options?: ReactiveEffectOptions) {
  const _effect = new ReactiveEffect(fn, () => {
    _effect.run()
  })
  // track at init, ensure track once at least
  _effect.run()

  if (options) {
    // update runner.scheduler
    Object.assign(_effect, options)
  }

  // return run(), which `this` point at effectObj
  return Object.assign(_effect.run.bind(_effect), { effect: _effect })
}

function cleanDepEffect(dep: Dep, effect: ReactiveEffect) {
  dep.delete(effect)
  if (dep.size === 0) {
    dep.cleanup()
  }
}

function trackEffect(effect: ReactiveEffect, dep: Dep) {
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
}

function triggerEffects(dep: Dep) {
  for (const effect of dep.keys()) {
    if (effect._dirtyLevel < DirtyLevels.DIRTY) {
      effect._dirtyLevel = DirtyLevels.DIRTY
    }

    if (effect.scheduler && effect._running === 0) {
      effect.scheduler()
    }
  }
}

export { activeEffect, effect, trackEffect, triggerEffects, ReactiveEffect }
export type { EffectFunction }
