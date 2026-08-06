import { describe, it, expect, vi } from "vitest"
import { computed, ref, reactive, effect } from "@soppy-vue/reactivity"

describe("computed", () => {
  describe("basic usage", () => {
    it("should return the computed value", () => {
      const a = ref(1)
      const b = ref(2)
      const sum = computed(() => a.value + b.value)

      expect(sum.value).toBe(3)
    })

    it("should lazily re-evaluate", () => {
      const count = ref(0)
      const double = computed(() => count.value * 2)

      expect(double.value).toBe(0)

      count.value = 5
      expect(double.value).toBe(10)
    })

    it("should be reactive in effects", () => {
      const count = ref(0)
      const double = computed(() => count.value * 2)
      let dummy = 0

      effect(() => {
        dummy = double.value
      })

      expect(dummy).toBe(0)

      count.value = 1
      expect(dummy).toBe(2)

      count.value = 5
      expect(dummy).toBe(10)
    })

    it("should chain multiple computed refs", () => {
      const count = ref(1)
      const double = computed(() => count.value * 2)
      const quadruple = computed(() => double.value * 2)
      let dummy = 0

      effect(() => {
        dummy = quadruple.value
      })

      expect(dummy).toBe(4)

      count.value = 2
      expect(dummy).toBe(8)
    })
  })

  describe("caching", () => {
    it("should cache the computed value until dependencies change", () => {
      const count = ref(0)
      const fn = vi.fn(() => count.value * 2)
      const double = computed(fn)

      expect(double.value).toBe(0)
      expect(fn).toHaveBeenCalledTimes(1)

      // accessing again without dep change should not re-run getter
      expect(double.value).toBe(0)
      expect(double.value).toBe(0)
      expect(fn).toHaveBeenCalledTimes(1)

      // dep change invalidates cache
      count.value = 1
      expect(double.value).toBe(2)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("should not re-run effect when computed value stays the same", () => {
      const a = ref(1)
      const b = ref(2)
      const sum = computed(() => a.value + b.value)
      const fn = vi.fn(() => {
        void sum.value
      })

      effect(fn)
      expect(fn).toHaveBeenCalledTimes(1)

      // no dep changed — computed still cached, effect not re-run
      void sum.value
      void sum.value
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("setter", () => {
    it("should support writable computed via get/set options", () => {
      const count = ref(0)
      const double = computed({
        get: () => count.value * 2,
        set: (val: number) => {
          count.value = val / 2
        },
      })

      expect(double.value).toBe(0)

      double.value = 10
      expect(double.value).toBe(10)
      expect(count.value).toBe(5)
    })

    it("should trigger effects when setter updates deps", () => {
      const count = ref(0)
      const double = computed({
        get: () => count.value * 2,
        set: (val: number) => {
          count.value = val / 2
        },
      })
      let dummy = 0

      effect(() => {
        dummy = double.value
      })

      expect(dummy).toBe(0)

      double.value = 6
      expect(dummy).toBe(6)
    })
  })

  describe("dependency on reactive objects", () => {
    it("should track changes in reactive objects", () => {
      const obj = reactive({ a: 1, b: 2 })
      const sum = computed(() => obj.a + obj.b)
      let dummy = 0

      effect(() => {
        dummy = sum.value
      })

      expect(dummy).toBe(3)

      obj.a = 10
      expect(dummy).toBe(12)

      obj.b = 20
      expect(dummy).toBe(30)
    })

    it("should track nested properties in reactive objects", () => {
      const obj = reactive({ nested: { value: "hello" } })
      const upper = computed(() => obj.nested.value.toUpperCase())
      let dummy = ""

      effect(() => {
        dummy = upper.value
      })

      expect(dummy).toBe("HELLO")

      obj.nested.value = "world"
      expect(dummy).toBe("WORLD")
    })
  })

  describe("dependency cleanup", () => {
    it("should untrack stale dependencies when branching", () => {
      const useA = ref(true)
      const a = ref(1)
      const b = ref(2)
      const pick = computed(() => (useA.value ? a.value : b.value))
      let result = 0
      const fn = vi.fn(() => {
        result = pick.value
      })

      effect(fn)
      expect(result).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)

      a.value = 10
      expect(result).toBe(10)
      expect(fn).toHaveBeenCalledTimes(2)

      useA.value = false
      expect(result).toBe(2)
      expect(fn).toHaveBeenCalledTimes(3)

      a.value = 100
      expect(fn).toHaveBeenCalledTimes(3)
      expect(result).toBe(2)

      b.value = 20
      expect(result).toBe(20)
      expect(fn).toHaveBeenCalledTimes(4)
    })
  })
})
