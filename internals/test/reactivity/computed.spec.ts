import { computed, reactive, effect, isRef } from "@soppy-vue/reactivity"

describe("computed(getter)", () => {
  it("is lazy: getter does not run until `.value` is first read", () => {
    let runs = 0
    const c = computed(() => {
      runs++
      return 1
    })
    expect(runs).toBe(0)
    void c.value
    expect(runs).toBe(1)
  })

  it("returns the getter result", () => {
    const c = computed(() => 42)
    expect(c.value).toBe(42)
  })

  it("caches: reading `.value` twice without a dep change runs the getter once", () => {
    let runs = 0
    const c = computed(() => {
      runs++
      return 1
    })
    void c.value
    void c.value
    expect(runs).toBe(1)
  })

  it("invalidates and recomputes when a tracked dep changes", () => {
    const o = reactive({ n: 1 })
    let runs = 0
    const c = computed(() => {
      runs++
      return o.n * 2
    })
    expect(c.value).toBe(2)
    expect(runs).toBe(1)

    o.n = 2
    expect(c.value).toBe(4)
    expect(runs).toBe(2)
  })

  it("is a ref", () => {
    expect(isRef(computed(() => 1))).toBe(true)
  })
})

describe("reactive dependency", () => {
  it("an effect reading `computed.value` re-runs when the source changes", () => {
    const o = reactive({ n: 1 })
    const c = computed(() => o.n * 2)
    let calls = 0
    effect(() => {
      void c.value
      calls++
    })
    expect(calls).toBe(1)

    o.n = 2
    expect(calls).toBe(2)
  })

  it("effect tracks the computed, not its untracked raw deps", () => {
    const o = reactive({ a: 1, b: 1 })
    const c = computed(() => o.a)
    let calls = 0
    effect(() => {
      void c.value
      calls++
    })
    expect(calls).toBe(1)

    // `b` is not a dep of the computed -> no re-run
    o.b = 2
    expect(calls).toBe(1)
  })
})

describe("computed({ get, set }) (writable)", () => {
  it("`.value = x` invokes the setter", () => {
    let received: unknown
    const c = computed({
      get: () => 1,
      set: (v) => {
        received = v
      },
    })
    c.value = 99
    expect(received).toBe(99)
  })

  it("getter still caches until a source changes", () => {
    const o = reactive({ n: 1 })
    let runs = 0
    const c = computed({
      get: () => {
        runs++
        return o.n
      },
      set: (v: number) => {
        o.n = v
      },
    })
    void c.value
    void c.value
    expect(runs).toBe(1)

    c.value = 5
    // fix: unexpected check order
    expect(c.value).toBe(5)
    expect(runs).toBe(2)
  })

  it("exposes `.effect` (a ReactiveEffect)", () => {
    const c = computed({ get: () => 1, set: () => {} })
    expect(c.effect).toBeTruthy()
    expect(typeof c.effect.run).toBe("function")
  })
})

describe("getter receives old value", () => {
  it("passes the previous value as the first arg", () => {
    const o = reactive({ n: 1 })
    const seen: number[] = []
    const c = computed((old?: number) => {
      seen.push(old as number)
      return o.n
    })
    expect(c.value).toBe(1)
    o.n = 2
    expect(c.value).toBe(2)
    // first call receives `undefined`, second receives previous value 1
    expect(seen).toEqual([undefined, 1])
  })
})
