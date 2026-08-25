import type { TransitionTarget } from "../components"
import { TransitionFlags } from "../constants"

function patchClass(el: Element, value: string) {
  /**
   * note: vue use two ways to inject className:
   * - vnode classes are written via `el.className`
   * - Transition classes are added via `el.classList`
   */
  const transitionClasses = (el as TransitionTarget)[TransitionFlags.CLASS]
  if (transitionClasses) {
    value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ")
  }

  if (value == null) {
    el.removeAttribute("class")
  } else {
    el.className = value
  }
}

export { patchClass }
