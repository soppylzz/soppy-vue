import { watch, watchEffect, nextTick } from "@soppy-vue/runtime-core"
import { ref, reactive } from "@soppy-vue/reactivity"

describe("watch(ref)", () => {
  it("fires when the ref changes; callback receives (newVal, oldVal)", async () => {
    const r = ref(1)
    let newVal: any = undefined
    let oldVal: any = undefined
    watch(r, (n, o) => {
      newVal = n
      oldVal = o
    })
    expect(newVal).toBeUndefined()
    r.value = 2
    await nextTick()
    expect(newVal).toBe(2)
    expect(oldVal).toBe(1)
  })

  it("does NOT fire when the same value is assigned (Object.is equal)", async () => {
    const r = ref(1)
    let calls = 0
    watch(r, () => calls++)
    r.value = 1
    await nextTick()
    expect(calls).toBe(0)
  })

  it("does not fire on creation (only on change)", async () => {
    const r = ref(1)
    let calls = 0
    watch(r, () => calls++)
    await nextTick()
    expect(calls).toBe(0)
  })
})

describe("watch(reactive)", () => {
  it("deep: fires on nested mutation by default", async () => {
    const o = reactive({ a: { b: 1 } })
    let calls = 0
    watch(o, () => calls++)
    o.a.b = 2
    await nextTick()
    expect(calls).toBe(1)
  })

  it("deep: false traverses only one level", async () => {
    const o = reactive({ a: { b: 1 }, c: 1 })
    let calls = 0
    watch(o, () => calls++, { deep: false })
    o.a.b = 2
    await nextTick()
    expect(calls).toBe(0)
    o.c = 2
    await nextTick()
    expect(calls).toBe(1)
  })
})

describe("watch(getter)", () => {
  it("fires when the getter result changes", async () => {
    const r = ref(1)
    let newVal: any
    watch(
      () => r.value * 2,
      (n) => {
        newVal = n
      }
    )
    r.value = 3
    await nextTick()
    expect(newVal).toBe(6)
  })
})

describe("watch(array of sources)", () => {
  it("fires when any source changes; newVal/oldVal are aligned arrays", async () => {
    const a = ref(1)
    const b = ref(2)
    let newVal: any
    let oldVal: any
    watch([a, b], (n, o) => {
      newVal = n
      oldVal = o
    })
    a.value = 10
    await nextTick()
    expect(newVal).toEqual([10, 2])
    expect(oldVal).toEqual([1, 2])
  })
})

describe("flush", () => {
  it("flush: sync fires synchronously on change", () => {
    const r = ref(1)
    let calls = 0
    watch(r, () => calls++, { flush: "sync" })
    r.value = 2
    expect(calls).toBe(1)
  })

  it("flush: pre (default) defers via queueJob until nextTick", async () => {
    const r = ref(1)
    let calls = 0
    watch(r, () => calls++)
    r.value = 2
    expect(calls).toBe(0)
    await nextTick()
    expect(calls).toBe(1)
  })

  it("flush: post defers via queuePostFlushCbs", async () => {
    const r = ref(1)
    let calls = 0
    watch(r, () => calls++, { flush: "post" })
    r.value = 2
    expect(calls).toBe(0)
    await nextTick()
    expect(calls).toBe(1)
  })
})

describe("watchEffect", () => {
  it("runs on the next tick by default (scheduled, not synchronous)", async () => {
    let calls = 0
    watchEffect(() => {
      calls++
    })
    expect(calls).toBe(0)
    await nextTick()
    expect(calls).toBe(1)
  })

  it("re-runs when tracked deps change", async () => {
    const r = ref(1)
    let calls = 0
    let seen: any
    watchEffect(() => {
      seen = r.value
      calls++
    })
    await nextTick()
    expect(calls).toBe(1)
    expect(seen).toBe(1)
    r.value = 2
    await nextTick()
    expect(calls).toBe(2)
    expect(seen).toBe(2)
  })

  it("flush: sync runs the effect immediately", () => {
    const r = ref(1)
    let calls = 0
    watchEffect(
      () => {
        void r.value
        calls++
      },
      { flush: "sync" }
    )
    expect(calls).toBe(1)
    r.value = 2
    expect(calls).toBe(2)
  })

  it("flush: post defers the first run to the post-flush queue", async () => {
    let calls = 0
    watchEffect(() => calls++, { flush: "post" })
    expect(calls).toBe(0)
    await nextTick()
    expect(calls).toBe(1)
  })
})

describe("stop", () => {
  it("watchHandler.stop() stops the watcher (no further callbacks)", async () => {
    const r = ref(1)
    let calls = 0
    const handler = watch(r, () => calls++)
    r.value = 2
    await nextTick()
    expect(calls).toBe(1)
    handler.stop()
    r.value = 3
    await nextTick()
    expect(calls).toBe(1)
  })
})

describe("allowRecurse", () => {
  it("a watch callback mutating its own source re-runs until a guard stops it", async () => {
    const count = ref(0)
    let watchRuns = 0
    watch(count, () => {
      watchRuns++
      if (count.value < 3) {
        count.value++
      }
    })
    count.value++
    await nextTick()
    expect(watchRuns).toBe(3)
    expect(count.value).toBe(3)
  })
})

describe("cleanup (onCleanup)", () => {
  it("onCleanup registered in a callback runs before the next callback invocation", async () => {
    const r = ref(1)
    const order: string[] = []
    watch(r, (_n, _o, onCleanup) => {
      order.push("cb")
      onCleanup(() => order.push("cleanup"))
    })
    r.value = 2
    await nextTick()
    r.value = 3
    await nextTick()
    expect(order).toEqual(["cb", "cleanup", "cb"])
  })
})
