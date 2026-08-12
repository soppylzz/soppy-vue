function patchClass(el: Element, value: string) {
  if (value === null) {
    el.removeAttribute("class")
  } else {
    el.className = value
  }
}

export { patchClass }
