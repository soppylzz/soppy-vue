import {
  reactive,
  shallowReactive,
  toRaw,
  isReactive,
  isShallow,
  isProxy,
  effect,
} from "@soppy-vue/reactivity"

describe("reactive", () => {
  it("returns a proxy wrapping the raw object", () => {
    const raw = { n: 1 }
    const observed = reactive(raw)
    expect(isReactive(observed)).toBe(true)
  })

  it("returns the same proxy for the same target (caching)", () => {
    const raw = { n: 1 }
    expect(reactive(raw)).toBe(reactive(raw))
  })

  it("returns the target unchanged for non-objects", () => {
    expect(reactive(1 as any)).toBe(1)
    expect(reactive("a" as any)).toBe("a")
    expect(reactive(true as any)).toBe(true)
    expect(reactive(null as any)).toBe(null)
  })

  it("returns the same proxy when passed an already-reactive proxy", () => {
    const observed = reactive({ n: 1 })
    expect(reactive(observed)).toBe(observed)
  })

  it("does NOT make the raw object reactive", () => {
    const raw = { n: 1 }
    reactive(raw)
    expect(isReactive(raw)).toBe(false)
  })

  it("lazily + deeply proxies nested objects", () => {
    const nested = { b: 1 }
    const observed = reactive({ a: nested })
    expect(isReactive(observed.a)).toBe(true)
    // nested proxy is cached across reads
    expect(observed.a).toBe(observed.a)
  })
})

describe("shallowReactive", () => {
  it("returns the raw nested object (no deep proxy)", () => {
    const nested = { b: 1 }
    const observed = shallowReactive({ a: nested })
    expect(observed.a).toBe(nested)
    expect(isReactive(observed.a)).toBe(false)
  })

  it("marks `__sv_isShallow`", () => {
    expect(isShallow(shallowReactive({}))).toBe(true)
    expect(isShallow(reactive({}))).toBe(false)
  })
})

describe("toRaw", () => {
  it("returns the raw object for a reactive proxy", () => {
    const raw = { n: 1 }
    expect(toRaw(reactive(raw))).toBe(raw)
  })

  it("is idempotent on a nested proxy", () => {
    const rawInner = { b: 1 }
    const observed = reactive({ a: rawInner })
    const innerProxy = observed.a
    expect(toRaw(innerProxy)).toBe(rawInner)
    expect(toRaw(innerProxy)).toBe(toRaw(toRaw(innerProxy)))
  })

  it("returns primitives unchanged", () => {
    expect(toRaw(1)).toBe(1)
    expect(toRaw("a")).toBe("a")
    expect(toRaw(null)).toBe(null)
  })
})

describe("isReactive / isShallow / isProxy", () => {
  it("isReactive is true only for reactive proxies (and nested), false elsewhere", () => {
    const observed = reactive({ a: { b: 1 } })
    expect(isReactive(observed)).toBe(true)
    expect(isReactive(observed.a)).toBe(true)

    expect(isReactive({})).toBe(false)
    expect(isReactive(shallowReactive({ a: {} }).a)).toBe(false)
    expect(isReactive(1)).toBe(false)
    expect(isReactive(null)).toBe(false)
  })

  it("isProxy(x) === isReactive(x)", () => {
    const observed = reactive({})
    expect(isProxy(observed)).toBe(isReactive(observed))
    expect(isProxy({})).toBe(isReactive({}))
    expect(isProxy(1)).toBe(isReactive(1))
  })
})

describe("array reactivity", () => {
  it("includes/indexOf/lastIndexOf track per-index", () => {
    const arr = reactive([1, 2, 3])
    let calls = 0
    effect(() => {
      void arr.includes(2)
      calls++
    })
    expect(calls).toBe(1)

    arr[0] = 10
    expect(calls).toBe(2)
  })

  it("setting `length` triggers deps of removed indices", () => {
    const arr = reactive([1, 2, 3])
    let calls = 0
    effect(() => {
      void arr[1]
      calls++
    })
    expect(calls).toBe(1)

    arr.length = 1
    expect(calls).toBe(2)
  })
})

describe("set semantics", () => {
  it("assigning the same value does not trigger effects", () => {
    const o = reactive({ a: 1 })
    let calls = 0
    effect(() => {
      void o.a
      calls++
    })
    expect(calls).toBe(1)

    o.a = 1
    expect(calls).toBe(1)
  })

  it("assigning a new value triggers only the effect tracking that key", () => {
    const o = reactive({ a: 1, b: 1 })
    let aCalls = 0
    let bCalls = 0
    effect(() => {
      void o.a
      aCalls++
    })
    effect(() => {
      void o.b
      bCalls++
    })
    expect(aCalls).toBe(1)
    expect(bCalls).toBe(1)

    o.a = 2
    expect(aCalls).toBe(2)
    expect(bCalls).toBe(1)
  })
})
