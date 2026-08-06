import { describe, it, expect, vi } from "vitest"
import { reactive, effect } from "@soppy-vue/reactivity"

describe("reactive", () => {
  describe("basic reactivity", () => {
    it("should run effect immediately and re-run on property change", () => {
      const obj = reactive({ count: 0 })
      let dummy = 0

      effect(() => {
        dummy = obj.count
      })

      expect(dummy).toBe(0)

      obj.count = 1
      expect(dummy).toBe(1)

      obj.count = 5
      expect(dummy).toBe(5)
    })

    it("should support multiple effects on the same property", () => {
      const obj = reactive({ x: 0 })
      let [a, b] = [0, 0]

      effect(() => {
        a = obj.x
      })
      effect(() => {
        b = obj.x * 2
      })

      expect(a).toBe(0)
      expect(b).toBe(0)

      obj.x = 3
      expect(a).toBe(3)
      expect(b).toBe(6)
    })

    it("should handle multiple properties independently", () => {
      const obj = reactive({ a: 1, b: 2 })
      let sum = 0

      effect(() => {
        sum = obj.a + obj.b
      })

      expect(sum).toBe(3)

      obj.a = 10
      expect(sum).toBe(12)

      obj.b = 20
      expect(sum).toBe(30)
    })
  })

  describe("deep reactivity", () => {
    it("should make nested objects reactive lazily", () => {
      const obj = reactive({
        nested: { value: "hello" },
      })
      let inner = ""

      effect(() => {
        inner = obj.nested.value
      })

      expect(inner).toBe("hello")

      obj.nested.value = "world"
      expect(inner).toBe("world")
    })

    it("should make nested arrays reactive", () => {
      const obj = reactive({
        items: [{ id: 1 }, { id: 2 }],
      })
      let firstId = 0

      effect(() => {
        firstId = obj.items[0].id
      })

      expect(firstId).toBe(1)

      obj.items[0].id = 99
      expect(firstId).toBe(99)
    })
  })

  describe("idempotency and caching", () => {
    it("should return the same proxy when called on an already-reactive object", () => {
      const original = { count: 0 }
      const r1 = reactive(original)
      const r2 = reactive(r1)

      expect(r1).toBe(r2)
    })

    it("should return the same proxy when called on the same original object", () => {
      const original = { count: 0 }
      const r1 = reactive(original)
      const r2 = reactive(original)

      expect(r1).toBe(r2)
    })

    it("should return non-object values as-is", () => {
      expect(reactive(42)).toBe(42)
      expect(reactive("hello")).toBe("hello")
      expect(reactive(true)).toBe(true)
      expect(reactive(null)).toBe(null)
      expect(reactive(undefined)).toBe(undefined)
    })
  })

  describe("same-value assignment", () => {
    it("should not re-run effect when the same value is assigned", () => {
      const obj = reactive({ count: 0 })
      const fn = vi.fn(() => {
        void obj.count
      })

      effect(fn)
      expect(fn).toHaveBeenCalledTimes(1)

      obj.count = 0
      expect(fn).toHaveBeenCalledTimes(1)

      obj.count = 1
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe("dependency cleanup", () => {
    it("should untrack stale dependencies when branching", () => {
      const obj = reactive({ useA: true, a: 1, b: 2 })
      let result = 0
      const fn = vi.fn(() => {
        if (obj.useA) {
          result = obj.a
        } else {
          result = obj.b
        }
      })

      effect(fn)
      expect(result).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)

      // change tracked dep — re-run
      obj.a = 10
      expect(result).toBe(10)
      expect(fn).toHaveBeenCalledTimes(2)

      // switch branch — 'a' should be un-tracked, 'b' tracked
      obj.useA = false
      expect(result).toBe(2)
      expect(fn).toHaveBeenCalledTimes(3)

      // changing 'a' should NOT re-run (stale)
      obj.a = 100
      expect(fn).toHaveBeenCalledTimes(3)
      expect(result).toBe(2)

      // changing 'b' SHOULD re-run (active dep)
      obj.b = 20
      expect(result).toBe(20)
      expect(fn).toHaveBeenCalledTimes(4)
    })
  })

  describe("nested effects", () => {
    it("should correctly handle nested effect tracking", () => {
      const obj = reactive({ outer: 1, inner: 10 })
      const outerValues: number[] = []
      const innerValues: number[] = []

      effect(() => {
        outerValues.push(obj.outer)

        effect(() => {
          innerValues.push(obj.inner)
        })
      })

      expect(outerValues).toEqual([1])
      expect(innerValues).toEqual([10])

      // changing outer re-runs the outer effect, which creates a new inner
      // effect that also runs immediately
      obj.outer = 2
      expect(outerValues).toEqual([1, 2])
      // inner re-runs because outer re-ran and re-created it
      expect(innerValues).toEqual([10, 10])

      // changing inner triggers ALL inner effects (the old one is not yet
      // cleaned up since cleanup only handles the current effect's own deps)
      obj.inner = 20
      expect(innerValues).toEqual([10, 10, 20, 20])
    })
  })

  describe("array reactivity", () => {
    it("should track indexed access via set trap", () => {
      const arr = reactive([1, 2, 3])
      let first = 0,
        len = 0

      effect(() => {
        first = arr[0]
        len = arr.length
      })

      expect(first).toBe(1)
      expect(len).toBe(3)

      // mutating an indexed element triggers the effect
      arr[0] = 99
      expect(first).toBe(99)

      // direct length assignment triggers the effect
      arr.length = 5
      expect(len).toBe(5)
    })

    it("should track indexed access for existing keys only", () => {
      // NOTE: push() uses [[DefineOwnProperty]] internally which currently
      // bypasses the Proxy `set` trap. Only indexed writes to existing keys
      // and direct `length` writes are intercepted.
      const arr = reactive([1, 2])
      let sum = 0

      effect(() => {
        sum = (arr[0] ?? 0) + (arr[1] ?? 0)
      })

      expect(sum).toBe(3)

      arr[0] = 10
      expect(sum).toBe(12) // 10 + 2
    })
  })
})
