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
      // origin comment: custom property definition
      style.setProperty(name, val)
    } else {
      // note: variables set to "important!" using
      // `setProperty` require special handling
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
    // in official vue3, it handles the conflict between
    // vShow and display here, ignored by our impl
  }
}

export { patchStyle }
