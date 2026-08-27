import {
  ref,
  shallowRef,
  isRef,
  toRef,
  toRefs,
  proxyRefs,
  triggerRef,
  reactive,
  effect,
  computed,
  isReactive,
  isShallow,
} from "@soppy-vue/reactivity"

describe("ref", () => {
  it("is a getter/setter over `value`", () => {
    const r = ref(1)
    expect(r.value).toBe(1)
    r.value = 2
    expect(r.value).toBe(2)
  })

  it("deep ref wraps an object in reactive", () => {
    const r = ref({ n: 1 })
    expect(isReactive(r.value)).toBe(true)
  })

  it("setting an equal value (Object.is) does not trigger effects", () => {
    const r = ref(1)
    let calls = 0
    effect(() => {
      void r.value
      calls++
    })
    expect(calls).toBe(1)
    r.value = 1
    expect(calls).toBe(1)
  })

  it("does not trigger on NaN -> NaN (Object.is equality)", () => {
    const r = ref(NaN)
    let calls = 0
    effect(() => {
      void r.value
      calls++
    })
    expect(calls).toBe(1)
    r.value = NaN
    expect(calls).toBe(1)
  })

  it("setting a new value triggers effects that read `.value`", () => {
    const r = ref(1)
    let calls = 0
    effect(() => {
      void r.value
      calls++
    })
    expect(calls).toBe(1)
    r.value = 2
    expect(calls).toBe(2)
  })

  it("ref(existingRef) returns the same ref (no double-wrap)", () => {
    const r = ref(1)
    expect(ref(r)).toBe(r)
  })

  it("ref() with no arg yields `value === undefined`", () => {
    const r = ref()
    expect(r.value).toBe(undefined)
  })
})

describe("shallowRef", () => {
  it("holds the raw object (NOT reactive)", () => {
    const raw = { n: 1 }
    const s = shallowRef(raw)
    expect(s.value).toBe(raw)
    expect(isReactive(s.value)).toBe(false)
  })

  it(".value change triggers effects; nested mutation does not", () => {
    const s = shallowRef({ n: 1 })
    let calls = 0
    effect(() => {
      void s.value
      calls++
    })
    expect(calls).toBe(1)

    s.value.n = 2
    expect(calls).toBe(1)

    s.value = { n: 3 }
    expect(calls).toBe(2)
  })

  it("marks `__sv_isShallow`", () => {
    expect(isShallow(shallowRef({}))).toBe(true)
    expect(isShallow(ref({}))).toBe(false)
  })
})

describe("isRef", () => {
  it("returns true for ref, shallowRef and computed", () => {
    expect(isRef(ref(1))).toBe(true)
    expect(isRef(shallowRef(1))).toBe(true)
    expect(isRef(computed(() => 1))).toBe(true)
  })

  it("returns false for primitives and plain objects", () => {
    expect(isRef(1)).toBe(false)
    expect(isRef({})).toBe(false)
    expect(isRef(null)).toBe(false)
  })
})

describe("toRef / toRefs", () => {
  it("returns a ref whose `.value` reads/writes `obj[k]`", () => {
    const obj = { k: 1 }
    const r = toRef(obj, "k")
    expect(r.value).toBe(1)
    r.value = 2
    expect(obj.k).toBe(2)
  })

  it("returns an already-ref property unchanged", () => {
    const inner = ref(1)
    const obj = { k: inner }
    expect(toRef(obj, "k")).toBe(inner)
  })

  it("toRef(reactiveObj, key) stays reactive", () => {
    const obj = reactive({ k: 1 })
    const r = toRef(obj, "k")
    let calls = 0
    effect(() => {
      void r.value
      calls++
    })
    expect(calls).toBe(1)
    obj.k = 2
    expect(calls).toBe(2)
  })

  it("toRefs returns refs for own enumerable keys, preserving the link", () => {
    const obj = { a: 1, b: 2 }
    const refs = toRefs(obj)
    expect(isRef(refs.a)).toBe(true)
    expect(isRef(refs.b)).toBe(true)
    expect(refs.a.value).toBe(1)
    refs.a.value = 10
    expect(obj.a).toBe(10)
  })
})

describe("proxyRefs", () => {
  it("get unwraps refs", () => {
    const p = proxyRefs({ a: ref(1) })
    expect(p.a).toBe(1)
  })

  it("set through a ref property writes `ref.value`, not replace the ref", () => {
    const o = { a: ref(1) }
    const p = proxyRefs(o)
    p.a = 2
    expect(o.a.value).toBe(2)
    expect(isRef(o.a)).toBe(true)
  })

  it("set through a non-ref property writes directly", () => {
    const o = { a: 1 }
    const p = proxyRefs(o)
    p.a = 2
    expect(o.a).toBe(2)
  })

  it("behaves like an unwrapped setup return", () => {
    const p = proxyRefs({ count: ref(1), label: "hi" })
    expect(p.count).toBe(1)
    expect(p.label).toBe("hi")
    p.count = 5
    p.label = "bye"
    expect(p.count).toBe(5)
    expect(p.label).toBe("bye")
  })
})

describe("triggerRef", () => {
  it("manually triggers effects tracking a shallow ref", () => {
    const s = shallowRef({ n: 1 })
    let calls = 0
    effect(() => {
      void s.value
      calls++
    })
    expect(calls).toBe(1)

    s.value.n = 2
    expect(calls).toBe(1)

    triggerRef(s)
    expect(calls).toBe(2)
  })
})

describe.runIf(__DEV__)("triggerRef (dev debug info)", () => {
  it("passes `ref.value` as `newVal` to onTrigger", () => {
    const s = shallowRef(1)
    let event: any
    effect(
      () => {
        void s.value
      },
      {
        onTrigger: (e) => {
          event = e
        },
      }
    )
    triggerRef(s)
    expect(event).toBeTruthy()
    expect(event.target).toBe(s)
    expect(event.key).toBe("value")
    expect(event.newVal).toBe(s.value)
  })
})
