import { isModelListener, isOn } from "@soppy-vue/shared"
import { patchClass, patchStyle, patchEvent, patchAttr } from "./modules"
import type { RendererOptions } from "@soppy-vue/runtime-core"

const patchProp: RendererOptions<Node, Element>["patchProp"] = (el, key, prev, next) => {
  if (key === "class") {
    patchClass(el, next)
  } else if (key === "style") {
    patchStyle(el, prev, next)
  } else if (isOn(key)) {
    !isModelListener(key) && patchEvent(el, key, next)
  } else {
    patchAttr(el, key, next)
  }
}

export { patchProp }
