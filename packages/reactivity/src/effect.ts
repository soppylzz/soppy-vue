import type { Dep } from "./dep"

let activeEffect: ReactiveEffect | null = null

type EffectFunction = () => void
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

  _depsLength = 0
  deps: Dep[] = []

  _running = 0
  public active = true

  /**
   * @param fn effect function, which track execute in
   * @param scheduler schedule how to execute effect function
   */
  constructor(
    public fn: EffectFunction,
    public scheduler: EffectScheduler
  ) {}

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

function effect(fn: EffectFunction, options?: ReactiveEffectOptions) {
  const runner = new ReactiveEffect(fn, () => {
    runner.run()
  })
  // track at init, ensure track once at least
  runner.run()

  if (options) {
    // update runner.scheduler
    Object.assign(runner, options)
  }

  // return run(), which this point at effectObj
  const run = Object.assign(runner.run.bind(runner), { runner })
  return run
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

function triggerEffect(dep: Dep) {
  for (const effect of dep.keys()) {
    if (effect.scheduler && effect._running === 0) {
      effect.scheduler()
    }
  }
}

export { activeEffect, effect, trackEffect, triggerEffect, ReactiveEffect }
