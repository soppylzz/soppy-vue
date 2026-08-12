import { isOn } from "@soppy-vue/shared"
import { patchClass, patchStyle, patchEvent, patchAttr } from "./modules"

function patchProp(el, key, prevValue, nextValue) {
  if (key === "class") {
    return patchClass(el, nextValue)
  } else if (key === "style") {
    patchStyle(el, prevValue, nextValue)
  } else if (isOn(key)) {
    patchEvent(el, key, nextValue)
  } else {
    patchAttr(el, key, nextValue)
  }
}

export { patchProp }
