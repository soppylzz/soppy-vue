function patchAttr(el: Element, key, value) {
  // fix: oops! used the opposite logic earlier
  if (value == null) {
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
}

export { patchAttr }
