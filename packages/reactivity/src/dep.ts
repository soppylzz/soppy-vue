import type { ReactiveEffect } from "./effect"

/**
 * bucket of tracked effects that depend on reactiveObj.key
 */
type Dep = Map<ReactiveEffect, number> & {
  cleanup: () => void
  key: PropertyKey
}

const createDep = (cleanup: () => void, key: PropertyKey) => {
  const dep = new Map() as Dep
  dep.key = key
  dep.cleanup = cleanup
  return dep
}

export type { Dep }
export { createDep }
