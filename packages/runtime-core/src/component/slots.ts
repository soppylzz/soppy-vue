import type { IfAny, Prettify } from "@soppy-vue/shared"
import { EMPTY_OBJ, isArray, isFunction, ShapeFlags } from "@soppy-vue/shared"
import type { VNode, VNodeNormalizedChildren } from "../vnode"
import { normalizeVNode } from "../vnode"
import type { ComponentInternalInstance } from "./component"
import { SlotInternals } from "../constant"
import { withCtx } from "./context"

interface SlotTarget {
  [SlotInternals.IS_NORM]?: boolean
}

type RawSlots = {
  [name: string]: unknown
  _ctx?: ComponentInternalInstance | null
  /**
   * manual render fn hint to skip forced children updates
   */
  $stable?: boolean
}

type Slot<T = any> = {
  (...args: IfAny<T, any[], T extends undefined ? [] : [T]>): VNode[]
}

type InternalSlots = Record<string, Slot | undefined>
type Slots = Readonly<InternalSlots>

/**
 * light: use private SlotSymbol, to prevent
 * user-declared slot props from being exposed
 */
declare const SlotSymbol: unique symbol
type SlotsType<T extends Record<string, any> = Record<string, any>> = { [SlotSymbol]?: T }

/**
 * strictly unwrap SlotsType, pass through as T is, with zero auto-transformation
 * used on consumer side (parent template / render function)
 * @example
 * ```ts
 * type MySlots = SlotsType<{ default: { msg: string }, header: (props: string) => any }>
 * type StrictUnwrapSlotsType<MySlots> = Readonly<MySlots>
 * ```
 */
type StrictUnwrapSlotsType<S extends SlotsType, T = NonNullable<S[typeof SlotSymbol]>> = [
  keyof S,
] extends [never]
  ? Slots
  : Readonly<T> & T

/**
 * loosely unwrap SlotsType, auto-normalize slot signatures, converting
 * "shorthand" declarations into proper slot functions.
 * used on definition side (inside comp / defineSlots)
 * @example
 * ```ts
 * type MySlots = SlotsType<{ default: string, header: (props: string) => any }>
 * type UnwrapSlotsType<MySlots> = Readonly<{
 *     default: Slot<{ msg: string }>,
 *     header: (props: string) => any
 * }>
 * ```
 */
type UnwrapSlotsType<S extends SlotsType, T = NonNullable<S[typeof SlotSymbol]>> = [
  keyof S,
] extends [never]
  ? Slots
  : Readonly<
      Prettify<{
        [K in keyof T]: NonNullable<T[K]> extends (...args: any[]) => any ? T[K] : Slot<T[K]>
      }>
    >

export type {
  SlotTarget,
  RawSlots,
  InternalSlots,
  Slots,
  SlotsType,
  StrictUnwrapSlotsType,
  UnwrapSlotsType,
}

/* ==================== norm slots ==================== */
const isInternalKey = (key: string) => key[0] === "_" || key === "$stable"

const normalizeSlotValue = (value: unknown): VNode[] =>
  isArray(value) ? (value as any[]).map(normalizeVNode) : [normalizeVNode(value as any)]

const normalizeSlot = (
  rawSlot: Function & SlotTarget,
  ctx?: ComponentInternalInstance | null
): Slot => {
  if (rawSlot[SlotInternals.IS_NORM]) {
    /**
     * light: use unknown cast to avoid type conflicts that
     * prevent the use of the `as` assertion
     */
    return rawSlot as unknown as Slot
  }
  const normalized = withCtx((...args: any[]) => {
    return normalizeSlotValue(rawSlot(args))
  }, ctx)

  // which is NOT a compiled slot
  return normalized as Slot
}

const normalizeObjectSlots = (rawSlots: RawSlots, slots: InternalSlots) => {
  const ctx = rawSlots._ctx
  for (const key in ctx) {
    if (isInternalKey(key)) continue
    const rawSlot = rawSlots[key]

    if (isFunction(rawSlot)) {
      slots[key] = normalizeSlot(rawSlot, ctx)
    } else if (rawSlot != null) {
      const normalized = normalizeSlotValue(rawSlot)
      slots[key] = () => normalized
    }
  }
}

const normalizeVNodeSlots = (
  children: VNodeNormalizedChildren,
  instance: ComponentInternalInstance
) => {
  const normalized = normalizeSlotValue(children)
  instance.slots.default = () => normalized
}

/* ==================== patch slots ==================== */
/**
 * slots is derived children and shapeFlag, this function is
 * primarily responsible for handling this issue
 */
const initSlots = (instance: ComponentInternalInstance, children: VNodeNormalizedChildren) => {
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    // handle object slots
    normalizeObjectSlots(children as unknown as RawSlots, (instance.slots = {}))
  } else {
    // handle vnode slots
    instance.slots = {}
    children && normalizeVNodeSlots(children, instance)
  }
}

const updateSlots = (instance: ComponentInternalInstance, children: VNodeNormalizedChildren) => {
  const { slots } = instance

  let needDeletionCheck = true
  let deletionComparisonTarget = EMPTY_OBJ

  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const raw = children as unknown as RawSlots
    needDeletionCheck = !raw.$stable
    normalizeObjectSlots(raw, slots)

    deletionComparisonTarget = raw
  } else if (children) {
    /**
     * pass value as slots, treated as slots.default(), handled specifically
     * in {@link normalizeObjectSlots}
     */
    normalizeVNodeSlots(children, instance)
    deletionComparisonTarget = { default: true }
  }

  if (needDeletionCheck) {
    for (const key in slots) {
      if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
        delete slots[key]
      }
    }
  }
}

export { initSlots, updateSlots }
