import { describe, it, expect, vi } from "vitest"
import { ref, effect, reactive, toRef, proxyRefs } from "@soppy-vue/reactivity"

describe("ref", () => {
  describe("basic reactivity", () => {
    it("should hold a value and track its changes via .value", () => {
      const count = ref(0)
      let dummy = 0

      effect(() => {
        dummy = count.value
      })

      expect(dummy).toBe(0)

      count.value = 1
      expect(dummy).toBe(1)

      count.value = 5
      expect(dummy).toBe(5)
    })

    it("should support multiple effects on the same ref", () => {
      const x = ref(0)
      let [a, b] = [0, 0]

      effect(() => {
        a = x.value
      })
      effect(() => {
        b = x.value * 2
      })

      expect(a).toBe(0)
      expect(b).toBe(0)

      x.value = 3
      expect(a).toBe(3)
      expect(b).toBe(6)
    })

    it("should handle multiple refs independently", () => {
      const a = ref(1)
      const b = ref(2)
      let sum = 0

      effect(() => {
        sum = a.value + b.value
      })

      expect(sum).toBe(3)

      a.value = 10
      expect(sum).toBe(12)

      b.value = 20
      expect(sum).toBe(30)
    })
  })

  describe("object values", () => {
    it("should make object values reactive", () => {
      const obj = ref({ count: 0 })
      let dummy = 0

      effect(() => {
        dummy = obj.value.count
      })

      expect(dummy).toBe(0)

      obj.value.count = 1
      expect(dummy).toBe(1)

      obj.value.count = 5
      expect(dummy).toBe(5)
    })

    it("should make nested objects reactive", () => {
      const obj = ref({ nested: { value: "hello" } })
      let inner = ""

      effect(() => {
        inner = obj.value.nested.value
      })

      expect(inner).toBe("hello")

      obj.value.nested.value = "world"
      expect(inner).toBe("world")
    })

    it("should make arrays reactive", () => {
      const arr = ref([1, 2, 3])
      let first = 0

      effect(() => {
        first = arr.value[0]
      })

      expect(first).toBe(1)

      arr.value[0] = 99
      expect(first).toBe(99)
    })
  })

  describe("isRef detection", () => {
    it("should have __sv_isRef flag set to true", () => {
      const r = ref(0)
      expect(r.__sv_isRef).toBe(true)
    })

    it("should distinguish ref from plain reactive object", () => {
      const r = ref(0)
      expect(r.__sv_isRef).toBe(true)

      const obj = { value: 0 }
      expect((obj as any).__sv_isRef).toBeUndefined()
    })
  })

  describe("same-value assignment", () => {
    it("should not re-run effect when the same primitive value is assigned", () => {
      const count = ref(0)
      const fn = vi.fn(() => {
        void count.value
      })

      effect(fn)
      expect(fn).toHaveBeenCalledTimes(1)

      count.value = 0
      expect(fn).toHaveBeenCalledTimes(1)

      count.value = 1
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("should not re-run effect when the same object reference is assigned", () => {
      const obj = { x: 1 }
      const r = ref(obj)
      const fn = vi.fn(() => {
        void r.value.x
      })

      effect(fn)
      expect(fn).toHaveBeenCalledTimes(1)

      r.value = obj
      expect(fn).toHaveBeenCalledTimes(1)

      r.value = { x: 2 }
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe("dependency cleanup", () => {
    it("should untrack stale dependencies when branching", () => {
      const useA = ref(true)
      const a = ref(1)
      const b = ref(2)
      let result = 0
      const fn = vi.fn(() => {
        if (useA.value) {
          result = a.value
        } else {
          result = b.value
        }
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

  describe("replacing the entire ref value", () => {
    it("should react when the whole object is replaced", () => {
      const r = ref({ a: 1 })
      let dummy = 0

      effect(() => {
        dummy = r.value.a
      })

      expect(dummy).toBe(1)

      r.value = { a: 2 }
      expect(dummy).toBe(2)

      r.value.a = 3
      expect(dummy).toBe(3)
    })
  })
})

describe("toRef", () => {
  describe("basic usage", () => {
    it("should create a ref to a reactive object property", () => {
      const obj = reactive({ count: 0 })
      const countRef = toRef(obj, "count")

      expect(countRef.__sv_isRef).toBe(true)
      expect(countRef.value).toBe(0)

      countRef.value = 1
      expect(countRef.value).toBe(1)
      expect(obj.count).toBe(1)

      obj.count = 2
      expect(countRef.value).toBe(2)
    })

    it("should be reactive in effects", () => {
      const obj = reactive({ count: 0 })
      const countRef = toRef(obj, "count")
      let dummy = 0

      effect(() => {
        dummy = countRef.value
      })

      expect(dummy).toBe(0)

      // mutating via ref
      countRef.value = 5
      expect(dummy).toBe(5)

      // mutating via original reactive object
      obj.count = 10
      expect(dummy).toBe(10)
    })

    it("should work with multiple toRefs on the same object", () => {
      const obj = reactive({ a: 1, b: 2 })
      const aRef = toRef(obj, "a")
      const bRef = toRef(obj, "b")
      let sum = 0

      effect(() => {
        sum = aRef.value + bRef.value
      })

      expect(sum).toBe(3)

      aRef.value = 10
      expect(sum).toBe(12)

      obj.b = 20
      expect(sum).toBe(30)
    })
  })
})

describe("proxyRefs", () => {
  describe("auto-unwrapping reads", () => {
    it("should unwrap ref values on read", () => {
      const obj = proxyRefs({
        count: ref(0),
        msg: "hello",
      })

      expect(obj.count).toBe(0)
      expect(obj.msg).toBe("hello")
    })

    it("should be reactive via auto-unwrap", () => {
      const obj = proxyRefs({
        count: ref(0),
      })
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

    it("should handle multiple refs in the same proxy", () => {
      const obj = proxyRefs({
        a: ref(1),
        b: ref(2),
      })
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

  describe("auto-unwrapping writes", () => {
    it("should unwrap ref values on write", () => {
      const count = ref(0)
      const obj = proxyRefs({ count })

      obj.count = 42
      expect(count.value).toBe(42)
    })

    it("should support setting non-ref properties", () => {
      const obj = proxyRefs({
        count: ref(0),
        label: "hi",
      })

      obj.label = "bye"
      expect(obj.label).toBe("bye")
    })
  })
})
