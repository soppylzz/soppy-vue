import type { UnionToIntersection } from "@soppy-vue/shared"
import {
  camelize,
  EMPTY_OBJ,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isModelListenerPrunedOn,
  isOn,
  isString,
  toHandlerKey,
} from "@soppy-vue/shared"
import type { ComponentInternalInstance, ConcreteComponent } from "./component"

type ObjectEmitsOptions = Record<string, ((...args: any[]) => any) | null>

type EmitsOptions = ObjectEmitsOptions | string[]

type EmitsToProps<T extends EmitsOptions> = T extends string[]
  ? {
      // 0. ["trigger"] => { onTrigger: (...args: any[]) => any }
      [K in `on${Capitalize<T[number]>}`]?: (...args: any[]) => any
    }
  : T extends ObjectEmitsOptions
    ? {
        // 1. { trigger: (obj: Custom) => any } => { onTrigger: (obj: Custom) => any }
        // 2. { trigger: null } => { onTrigger: (...args: any[]) => any }
        [K in `on${Capitalize<string & keyof T>}`]?: K extends `on${infer C}`
          ? (
              ...args: T[Uncapitalize<C>] extends (...args: infer P) => any
                ? P
                : T[Uncapitalize<C>] extends null
                  ? any[]
                  : never
            ) => any
          : never
      }
    : {}

type EmitFn<Options = ObjectEmitsOptions, Event extends keyof Options = keyof Options> =
  Options extends Array<infer V>
    ? (event: V, ...args: any[]) => void
    : // empty options check
      {} extends Options
      ? (event: string, ...args: any[]) => void
      : UnionToIntersection<
          // very classic {} => Intersection transformation
          {
            [key in Event]: Options[key] extends (...args: infer Args) => any
              ? (event: key, ...args: Args) => void
              : (event: key, ...args: any[]) => void
            /**
             * prune tuple-form payload branch (e.g. `submit: [{ id: number }]`) in official vue3
             * since its `ObjectEmitsOptions` doesn't define that shape.
             */
          }[Event]
        >

export type { ObjectEmitsOptions, EmitsOptions, EmitsToProps, EmitFn }

function normalizeEmitsOptions(comp: ConcreteComponent): ObjectEmitsOptions | null {
  /**
   * fixme: `comp.emits` resolves to a union like `{} | ThisType<void> | (string[] & ThisType<void>) | undefined`
   * generic `isArray<T>(val: T | T[])` fails here because TS infers `T` from the full flattened union.
   * temporary `as any` bypass until we find a way that correctly narrows unions containing `ThisType`
   */
  const raw = comp.emits as any
  const normalized: ObjectEmitsOptions = {}

  if (isArray(raw)) {
    raw.forEach((key) => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }

  return normalized
}

function isEmitListener(options: ObjectEmitsOptions | null, key: string) {
  if (!options || !isOn(key)) return false

  key = key.slice(2)

  // check scenario: "event-listener", "eventListener"
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
    hasOwn(options, hyphenate(key)) ||
    hasOwn(options, key)
  )
}

function emit(instance: ComponentInternalInstance, event: string, ...rest: any[]) {
  if (instance.isUnmounted) return
  const props = instance.vnode.props || EMPTY_OBJ

  let args = rest

  // origin comment: for v-model update:xxx events, apply modifiers on args
  const isModelListener = isModelListenerPrunedOn(event)
  const modelArg = isModelListener && event.slice(7)
  if (modelArg && modelArg in props) {
    const modifiersKey = `${modelArg === "modelValue" ? "model" : modelArg}Modifiers`
    const { trim } = props[modifiersKey] || EMPTY_OBJ

    trim && (args = rest.map((a) => (isString(a) ? a.trim() : a)))
  }

  let handlerName
  let handler =
    props[(handlerName = toHandlerKey(event))] ||
    props[(handlerName = toHandlerKey(camelize(event)))]

  if (!handler && isModelListener) {
    handler = props[(handlerName = toHandlerKey(hyphenate(event)))]
  }

  /**
   * in official vue3, it use handlerName to
   * handle `Once` suffix ignored in our impl
   */
  void handlerName

  handler && handler(...args)
}

export { normalizeEmitsOptions, isEmitListener, emit }
