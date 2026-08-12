function patchAttr(el: Element, key, value) {
  if (value) {
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
}

export { patchAttr }
