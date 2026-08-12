import type { MaybeArray } from "@soppy-vue/shared"
import { isArray, isString } from "@soppy-vue/shared"

type Style = string | Record<string, string> | null

function setStyle(style: CSSStyleDeclaration, name: string, val: MaybeArray<string>) {
  if (isArray(val)) {
    /**
     * light: use multi-value to support multiple browser
     * when setting an element, the browser only accepts valid values.
     *
     * @example
     * setStyle(style, "display", {display: ['-webkit-box', '-ms-flexbox', 'flex']})
     */
    val.forEach((v) => setStyle(style, name, v))
  } else {
    if (val === null) val = ""
    if (name.startsWith("--")) {
      style.setProperty(name, val)
    } else {
      // todo: browser prefix autoPrefixer, !important support
      style[name] = val
    }
  }
}

function patchStyle(el: Element, prev: Style, next: Style) {
  const style = (el as HTMLElement).style

  const isPrevString = isString(prev)
  const isNextString = isString(next)

  if (next) {
    if (isNextString) {
      // process: any => string
      // todo: source code also handles the reservation of some built-in CSS variables here
      if (prev !== next) {
        style.cssText = next
      }
    } else {
      // process: any => object
      if (prev && !isPrevString) {
        for (const key in prev) {
          if (next[key] === null) {
            setStyle(style, key, "")
          }
        }
      }
      Object.entries(next).forEach(([k, v]) => setStyle(style, k, v))
    }
  } else {
    if (prev) {
      // process: existed => null
      el.removeAttribute("style")
    }
  }
}

export { patchStyle }
