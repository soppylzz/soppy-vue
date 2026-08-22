import type { MaybeArray } from "@soppy-vue/shared"
import {
  camelize,
  EMPTY_ARR,
  EMPTY_OBJ,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isReservedProp,
} from "@soppy-vue/shared"
import type { ComponentInternalInstance, ConcreteComponent, Data } from "./component"
import { isEmitListener } from "./emits"
import { shallowReactive, toRaw, trigger } from "@soppy-vue/reactivity"
import { setCurrentInstance, unsetCurrentInstance } from "./context"

/* ==================== core type ==================== */
type PropType<T> = MaybeArray<PropConstructor<T>>
type PropConstructor<T = any> =
  // T & {} excludes null/undefined from the constructed type
  | { new (...args: any[]): T & {} }
  // FactoryFn, defined via {():T} or () => T
  | (() => T)
  | PropMethod<T>

/**
 * extracts a constructor type for **function-valued** props.
 * @example
 * PropMethod<{(...args: any[]): any}> => props: { onClick: Function }
 */
type PropMethod<T, TConstructor = any> =
  // light: wrap in tuple to disable union distribution — evaluates T as a whole
  [T] extends [((...args: any[]) => any) | undefined]
    ? /**
       * light: a structural mock of the built-in `Function` type, to represent "function-valued" props
       * `() => T`: call signature
       * `new (): TConstructor`: constructor signature
       * `readonly prototype: TConstructor`:
       *      prototype property, native function in JS have this property,
       *      claiming to implement granular function-like type definition
       */
      {
        (): T
        new (): TConstructor
        readonly prototype: TConstructor
      }
    : never

type DefaultFactory<T> = (props: Data) => T | null | undefined

type PropOptions<T = any, Default = T> = Partial<{
  type: PropType<T> | true | null
  required: boolean
  default: Default | DefaultFactory<Default> | null | undefined | object
  validator(value: unknown, props: Data): boolean
}>

export type { PropType }

/* ==================== norm propsOptions ==================== */
type NormalizedProp = null | PropOptions
type NormalizedProps = Record<string, NormalizedProp>

/**
 * in official vue3, it casts Boolean props (e.g. <comp foo/> => true, absent => false)
 * `NormalizedPropsOptions` are defined as `[NormalizedProps, needCastKeys[]]`; coercion in `resolvePropValue`
 * our implementation skip this casting for simplicity
 */
type NormalizedPropsOptions = NormalizedProps | {}

// validate whether prop name start with `$`
function validatePropName(key: string) {
  return !key.startsWith("$")
}

function normalizePropsOptions(comp: ConcreteComponent): NormalizedPropsOptions {
  // origin code: raw also resolved to `any` here
  const raw = comp.props
  const normalized: NormalizedPropsOptions = {}

  if (!raw) return EMPTY_ARR as any

  if (isArray(raw)) {
    // resolve `props: ['msg', 'count']`
    for (let i = 0; i < raw.length; i++) {
      const normalizedKey = camelize(raw[i])
      if (validatePropName(raw[i])) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else {
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(key)) {
        const opt = raw[key]
        normalized[normalizedKey] =
          isArray(opt) || isFunction(opt)
            ? // use `isFunction` to determine constructor (e.g. foo: [String, Number], foo: String)
              { type: opt }
            : extend({}, opt)
        // skip casting type check
      }
    }
  }
  return normalized
}

export type { NormalizedPropsOptions }
export { normalizePropsOptions }

/* ==================== patch prop ==================== */
function setFullProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  props: Data,
  attrs: Data
) {
  const { propsOptions, emitsOptions } = instance
  let hasAttrsChanged = false

  if (rawProps) {
    for (const key in rawProps) {
      if (isReservedProp(key)) {
        continue
      }
      let camelKey
      const value = rawProps[key]

      if (propsOptions && hasOwn(propsOptions, (camelKey = camelize(key)))) {
        /**
         * light: vue compiles kebab-case attrs in template into camelCase
         * props, following JS naming convention
         *
         * @example
         * template: <comp user-name="" />
         * compiled: { userName: "" }
         */
        props[camelKey] = value
      } else if (!isEmitListener(emitsOptions, key)) {
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value
          hasAttrsChanged = true
        }
      }
    }
  }

  return hasAttrsChanged
}

function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance
) {
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, "default")

    if (hasDefault && value === undefined) {
      const defaultValue = opt.default
      if (opt.type !== Function && isFunction(defaultValue)) {
        /**
         * light: use `propsDefaults` to cache the first return of default function, and
         * reuse them in next access, which can avoid causing unexpected side effects
         */
        const { propsDefaults } = instance
        if (key in propsDefaults) {
          value = propsDefaults[key]
        } else {
          setCurrentInstance(instance)
          value = propsDefaults[key] = defaultValue(props)
          unsetCurrentInstance()
        }
      } else {
        value = defaultValue
      }
    }
  }
  // boolean casting here, ignored in our impl
  return value
}

function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  isStateful: boolean
) {
  const props: Data = {}
  const attrs: Data = {}

  // setup propsDefaults, to avoid EMPTY_OBJ directly
  instance.propsDefaults = Object.create(null)

  setFullProps(instance, rawProps, props, attrs)

  if (isStateful) {
    // official vue3 use `shallowReactive` here, use `reactive` for now
    instance.props = shallowReactive(props)
  } else {
    /**
     * handle function component props
     * commit tricky: w/ === with, w/o === without
     */
    instance.props = !instance.type.props ? attrs : props
  }
  instance.attrs = attrs
}

function updateProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  rawPrevProps: Data | null
) {
  const { props, propsOptions, attrs } = instance
  const rawCurrentProps = toRaw(props)
  let hasAttrsChanged = false

  /**
   * in official vue3, provide a fast-path here, for:
   * - compilation optimizations ( exclude FULL_PROPS )
   * - HMR scenarios
   * however, our impl has not implemented due to complexity,
   * all updates of props are processed via FULL_PROPS
   */
  /* =============== full update (start) =============== */
  if (setFullProps(instance, rawProps, props, attrs)) {
    hasAttrsChanged = true
  }

  let kebabKey: string
  for (const key in rawCurrentProps) {
    kebabKey = hyphenate(key)

    /**
     * self-design: hasOwn is quite costly, official vue uses a more
     * efficient way; for the sake of readablity, we choose the approach
     * below
     */
    if (!rawProps || (!hasOwn(rawProps, key) && !hasOwn(rawProps, kebabKey))) {
      if (propsOptions) {
        if (
          rawPrevProps &&
          (rawPrevProps[key] !== undefined || rawPrevProps[kebabKey] !== undefined)
        ) {
          // newKey finded in oldProps
          props[key] = resolvePropValue(propsOptions, rawCurrentProps, key, undefined, instance)
        } else {
          delete props[key]
        }
      }
    }
  }

  /**
   * light: in practice, there are cases where `attrs === rawCurrentProps`
   * when FunctionalComponent has not been assigned only props, attrs is
   * used as fallback
   */
  if (attrs !== rawCurrentProps) {
    for (const key in attrs) {
      if (!rawProps || !hasOwn(rawProps, key)) {
        delete attrs[key]
        hasAttrsChanged = true
      }
    }
  }
  /* =============== full update (end) =============== */

  if (hasAttrsChanged) {
    trigger(instance, "$attrs")
  }
}

export { initProps, updateProps }
