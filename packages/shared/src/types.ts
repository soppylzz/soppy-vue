/**
 * deprecated: in TypeScript, `object` excludes
 * `null` and `undefined`, unlike `typeof` checks
 * in JavaScript.
 */
// type NonNullObject = Record<PropertyKey, any>

// if T accept any, return Y, otherwise N
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

type MaybeArray<T> = T | T[]

/**
 * origin comment: make keys required but keep undefined values
 * how it works:
 * @example LooseRequired<{ name?: String }>
 * - { name?: String } === { name?: String | undefined }
 * - T & Required<T> => { name: String }
 * - T["name"] => String | undefined
 */
type LooseRequired<T> = { [P in keyof (T & Required<T>)]: T[P] }

// light: flatten intersection types, make readable in IDE hover tooltips
type Prettify<T> = { [K in keyof T]: T[K] } & {}

/**
 * very common type utility, unidirectional conversion: A|B|C => A&B&C
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

type KeysMatching<T, Target> = {
  [K in keyof T]-?: T[K] extends Target ? K : never
}[keyof T]

export type { IfAny, MaybeArray, LooseRequired, Prettify, UnionToIntersection, KeysMatching }
