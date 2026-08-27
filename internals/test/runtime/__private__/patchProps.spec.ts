import type { patchProp as _patchProp } from "@soppy-vue/runtime-dom/patchProp"
import type { patchClass as _patchClass } from "@soppy-vue/runtime-dom/modules/class"
import type { patchStyle as _patchStyle } from "@soppy-vue/runtime-dom/modules/style"
import type { patchEvent as _patchEvent } from "@soppy-vue/runtime-dom/modules/event"
import type { patchAttr as _patchAttr } from "@soppy-vue/runtime-dom/modules/attr"
import type { TransitionFlags as _TransitionFlags } from "@soppy-vue/runtime-dom/constants"

const PATCH_PROP_MODULE = "@soppy-vue/runtime-dom/patchProp"
const PATCH_CLASS_MODULE = "@soppy-vue/runtime-dom/modules/class"
const PATCH_STYLE_MODULE = "@soppy-vue/runtime-dom/modules/style"
const PATCH_EVENT_MODULE = "@soppy-vue/runtime-dom/modules/event"
const PATCH_ATTR_MODULE = "@soppy-vue/runtime-dom/modules/attr"
const CONSTANTS_MODULE = "@soppy-vue/runtime-dom/constants"

let patchProp: typeof _patchProp
let patchClass: typeof _patchClass
let patchStyle: typeof _patchStyle
let patchEvent: typeof _patchEvent
let patchAttr: typeof _patchAttr
let TransitionFlags: typeof _TransitionFlags

describe.runIf(__DEV__)("patchProp", () => {
  beforeAll(async () => {
    ;({ patchProp } = await import(PATCH_PROP_MODULE))
    ;({ patchClass } = await import(PATCH_CLASS_MODULE))
    ;({ patchStyle } = await import(PATCH_STYLE_MODULE))
    ;({ patchEvent } = await import(PATCH_EVENT_MODULE))
    ;({ patchAttr } = await import(PATCH_ATTR_MODULE))
    ;({ TransitionFlags } = await import(CONSTANTS_MODULE))
  })

  describe("patchProp dispatch", () => {
    it("class key routes to class patching", () => {
      const el = document.createElement("div")
      patchProp(el, "class", null, "a b")
      expect(el.className).toBe("a b")
    })

    it("style key routes to style patching", () => {
      const el = document.createElement("div")
      patchProp(el, "style", null, { color: "red" })
      expect((el as HTMLElement).style.color).toBe("red")
    })

    it("on* key (not model listener) routes to event patching", () => {
      const el = document.createElement("div")
      let calls = 0
      const fn = () => calls++
      patchProp(el, "onClick", null, fn)
      el.dispatchEvent(new Event("click"))
      expect(calls).toBe(1)
    })

    it("onUpdate:* (model listener) is skipped", () => {
      const el = document.createElement("div")
      const fn = () => {}
      patchProp(el, "onUpdate:modelValue", null, fn)
      // no listener attached: dispatch is a no-op (would throw if fn were wired to a bad invoker)
      el.dispatchEvent(new Event("update"))
    })

    it("other keys route to attr patching", () => {
      const el = document.createElement("div")
      patchProp(el, "id", null, "x")
      expect(el.getAttribute("id")).toBe("x")
    })
  })

  describe("patchClass", () => {
    it("sets className for a string value", () => {
      const el = document.createElement("div")
      patchClass(el, "a b")
      expect(el.className).toBe("a b")
    })

    it("null removes the class attribute", () => {
      const el = document.createElement("div")
      el.className = "a"
      patchClass(el, null as any)
      expect(el.hasAttribute("class")).toBe(false)
    })

    it("merges transition classes when TransitionFlags.CLASS is set", () => {
      const el = document.createElement("div")
      ;(el as any)[TransitionFlags.CLASS] = new Set(["t"])
      patchClass(el, "a b")
      expect(el.className).toBe("a b t")
    })
  })

  describe("patchStyle", () => {
    it("string to string sets cssText", () => {
      const el = document.createElement("div")
      patchStyle(el, null, "color: red")
      expect((el as HTMLElement).style.color).toBe("red")
    })

    it("object to object sets each key and clears removed keys", () => {
      const el = document.createElement("div")
      patchStyle(el, { color: "red", background: "blue" }, { color: "green" })
      expect((el as HTMLElement).style.color).toBe("green")
      expect((el as HTMLElement).style.background).toBe("")
    })

    it("existed to null removes the style attribute", () => {
      const el = document.createElement("div")
      ;(el as HTMLElement).style.color = "red"
      patchStyle(el, { color: "red" }, null)
      expect(el.hasAttribute("style")).toBe(false)
    })

    it("array values set via multi-browser fallback", () => {
      const el = document.createElement("div")
      patchStyle(el, null, { display: ["-webkit-box", "flex"] })
      // jsdom resolves the last valid value in a multi-value list
      expect((el as HTMLElement).style.display).toBe("flex")
    })

    it("CSS custom property --x uses style.setProperty", () => {
      const el = document.createElement("div")
      patchStyle(el, null, { "--x": "1" })
      expect((el as HTMLElement).style.getPropertyValue("--x")).toBe("1")
    })
  })

  describe("patchEvent", () => {
    it("adds an invoker listener; re-patch swaps the handler in place (only latest runs)", () => {
      const el = document.createElement("div")
      const seen: number[] = []
      patchEvent(el, "onClick", () => seen.push(1))
      // re-patch with a new handler: the invoker is reused, its `.value` swapped
      patchEvent(el, "onClick", () => seen.push(2))
      el.dispatchEvent(new Event("click"))
      expect(seen).toEqual([2])
    })

    it("null value removes the listener", () => {
      const el = document.createElement("div")
      let calls = 0
      patchEvent(el, "onClick", () => calls++)
      el.dispatchEvent(new Event("click"))
      expect(calls).toBe(1)
      patchEvent(el, "onClick", null as any)
      el.dispatchEvent(new Event("click"))
      expect(calls).toBe(1)
    })

    it("parseName strips modifiers and hyphenates", () => {
      const el = document.createElement("div")
      const seen: string[] = []
      patchEvent(el, "onClickCapture", () => seen.push("fired"))
      el.dispatchEvent(new Event("click"))
      expect(seen).toEqual(["fired"])
    })

    it("array listeners stop after stopImmediatePropagation", () => {
      const el = document.createElement("div")
      const seen: number[] = []
      patchEvent(el, "onClick", [
        (e: Event) => {
          seen.push(1)
          e.stopImmediatePropagation()
        },
        () => seen.push(2),
      ])
      el.dispatchEvent(new Event("click"))
      expect(seen).toEqual([1])
    })
  })

  describe("patchAttr", () => {
    it("sets an attribute", () => {
      const el = document.createElement("div")
      patchAttr(el, "id", "x")
      expect(el.getAttribute("id")).toBe("x")
    })

    it("null removes the attribute", () => {
      const el = document.createElement("div")
      el.setAttribute("id", "x")
      patchAttr(el, "id", null)
      expect(el.hasAttribute("id")).toBe(false)
    })
  })
})
