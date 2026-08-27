import {
  effect,
  reactive,
  activeEffect,
  toggleTracking,
  resetTracking,
  track,
  trigger,
  toRaw,
} from "@soppy-vue/reactivity"

describe("effect basics", () => {
  it("runs the function immediately on creation", () => {
    let ran = 0
    effect(() => {
      ran++
    })
    expect(ran).toBe(1)
  })

  it("returns a runner bound to the effect", () => {
    let ran = 0
    const runner = effect(() => {
      ran++
    })
    expect(typeof runner).toBe("function")
    expect(runner.effect).toBeTruthy()
    // runner.effect has a run() method
    expect(typeof runner.effect.run).toBe("function")
  })

  it("sets `activeEffect` inside the fn and restores it after", () => {
    let seen: unknown = null
    const runner = effect(() => {
      seen = activeEffect
    })
    expect(seen).toBe(runner.effect)
    // restored to null (or prior value) after the run
    expect(activeEffect).toBeNull()
  })

  it("lazy: true does not run immediately; first runner() runs and collects", () => {
    let ran = 0
    const runner = effect(
      () => {
        ran++
      },
      { lazy: true }
    )
    expect(ran).toBe(0)
    runner()
    expect(ran).toBe(1)
  })
})

describe("dependency tracking & cleanup", () => {
  it("tracks only the keys actually read", () => {
    const o = reactive({ a: 1, b: 2 })
    let calls = 0
    effect(() => {
      void o.a
      calls++
    })
    expect(calls).toBe(1)

    o.b = 3
    expect(calls).toBe(1)
  })

  it("re-runs on a tracked key change", () => {
    const o = reactive({ a: 1 })
    let calls = 0
    effect(() => {
      void o.a
      calls++
    })
    expect(calls).toBe(1)

    o.a = 2
    expect(calls).toBe(2)
  })

  it("cleans up deps from a branch that is no longer taken", () => {
    const o = reactive({ flag: true, a: 1, b: 1 })
    let calls = 0
    effect(() => {
      if (o.flag) {
        void o.a
      } else {
        void o.b
      }
      calls++
    })
    expect(calls).toBe(1)

    // switch branch: previously-tracked `a` should no longer re-trigger
    o.flag = false
    expect(calls).toBe(2)

    const before = calls
    o.a = 100
    expect(calls).toBe(before)

    // new branch `b` still triggers
    o.b = 100
    expect(calls).toBe(before + 1)
  })

  it("dedupes multiple reads of the same key in one run", () => {
    const o = reactive({ a: 1 })
    let calls = 0
    effect(() => {
      void o.a
      void o.a
      void o.a
      calls++
    })
    expect(calls).toBe(1)

    o.a = 2
    expect(calls).toBe(2)
  })
})

describe("scheduler", () => {
  it("with a scheduler, a trigger calls the scheduler, not the runner", () => {
    const o = reactive({ a: 1 })
    let runs = 0
    let sched = 0
    const runner = effect(
      () => {
        void o.a
        runs++
      },
      { scheduler: () => sched++ }
    )
    expect(runs).toBe(1)

    o.a = 2
    expect(runs).toBe(1)
    expect(sched).toBe(1)

    // runner still re-runs manually
    runner()
    expect(runs).toBe(2)
  })

  it("the default scheduler only runs when dirty", () => {
    const o = reactive({ a: 1 })
    let runs = 0
    effect(() => {
      void o.a
      runs++
    })
    expect(runs).toBe(1)

    o.a = 2
    expect(runs).toBe(2)

    // no further changes -> no further runs
    expect(runs).toBe(2)
  })
})

describe("stop", () => {
  it("after stop, triggers no longer re-run", () => {
    const o = reactive({ a: 1 })
    let calls = 0
    const runner = effect(() => {
      void o.a
      calls++
    })
    expect(calls).toBe(1)

    runner.effect.stop()
    o.a = 2
    expect(calls).toBe(1)
  })

  it("runner() after stop still executes the fn but does NOT re-track", () => {
    const o = reactive({ a: 1 })
    let calls = 0
    const runner = effect(() => {
      void o.a
      calls++
    })
    runner.effect.stop()
    expect(calls).toBe(1)

    runner()
    expect(calls).toBe(2)

    // not re-tracked: subsequent change does not trigger
    o.a = 2
    expect(calls).toBe(2)
  })

  it("onStop is invoked once on stop", () => {
    let stopped = 0
    const runner = effect(() => {}, { onStop: () => stopped++ })

    runner.effect.stop()
    expect(stopped).toBe(1)

    runner.effect.stop()
    expect(stopped).toBe(1)
  })
})

describe("recursion / allowRecurse", () => {
  it("a self-triggering effect is deduped by default (no infinite loop)", () => {
    const o = reactive({ a: 0 })
    let calls = 0
    effect(() => {
      void o.a
      calls++
      if (o.a < 3) o.a++
    })
    // without allowRecurse, the self-trigger is skipped while _running
    expect(calls).toBe(1)
    expect(o.a).toBe(1)
  })

  it("allowRecurse: true permits re-enqueueing until a guard stops it", () => {
    const o = reactive({ a: 0 })
    let calls = 0
    effect(
      () => {
        calls++
        void o.a
        if (o.a < 5) o.a++
      },
      { allowRecurse: true }
    )
    expect(calls).toBeGreaterThan(1)
    expect(o.a).toBe(5)
  })
})

describe("track / toggleTracking / resetTracking", () => {
  it("toggleTracking(false) suppresses track(); resetTracking() restores", () => {
    const raw = { a: 1, b: 1 }
    let runs = 0
    effect(() => {
      track(raw, "a") // default true -> collect
      toggleTracking(false)
      track(raw, "b") // false -> no-op
      resetTracking() // restore default true
      runs++
    })
    expect(runs).toBe(1)

    trigger(raw, "a", 2, 1)
    expect(runs).toBe(2) // a collected
    trigger(raw, "b", 2, 1)
    expect(runs).toBe(2) // b not collected
  })

  it("nested toggles unwind correctly (stack semantics)", () => {
    const raw = { a: 1, b: 1, c: 1 }
    let runs = 0
    effect(() => {
      track(raw, "a") // default true -> collect
      toggleTracking(false)
      toggleTracking(true)
      track(raw, "b") // innermost true -> collect
      resetTracking() // pop true -> false
      track(raw, "c") // false -> no-op
      resetTracking() // pop false -> default true
      runs++
    })
    expect(runs).toBe(1)

    trigger(raw, "a", 2, 1)
    expect(runs).toBe(2) // a collected
    trigger(raw, "b", 2, 1)
    expect(runs).toBe(3) // b collected
    trigger(raw, "c", 2, 1)
    expect(runs).toBe(3) // c not collected
  })
})

describe.runIf(__DEV__)("dev debugger hooks", () => {
  it("onTrack fires with { effect, target, key } during tracking", () => {
    const o = reactive({ a: 1 })
    let event: any
    effect(
      () => {
        void o.a
      },
      {
        onTrack: (e) => {
          event = e
        },
      }
    )
    expect(event).toBeTruthy()
    expect(event.effect).toBeTruthy()
    expect(event.target).toBe(toRaw(o))
    expect(event.key).toBe("a")
  })
  it("onTrigger fires with { effect, target, key, newVal, oldVal } during trigger", () => {
    const o = reactive({ a: 1 })
    let event: any
    effect(
      () => {
        void o.a
      },
      {
        onTrigger: (e) => {
          event = e
        },
      }
    )
    o.a = 2
    expect(event).toBeTruthy()
    expect(event.effect).toBeTruthy()
    expect(event.target).toBe(toRaw(o))
    expect(event.key).toBe("a")
    expect(event.newVal).toBe(2)
    expect(event.oldVal).toBe(1)
  })
})
