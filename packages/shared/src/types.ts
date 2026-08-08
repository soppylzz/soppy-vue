/**
 * self-design: use `any` to skip some recursion check
 */
type NonNullObject = Record<PropertyKey, any>

/**
 * if T accept any, return Y, otherwise N
 */
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

export type { NonNullObject, IfAny }
