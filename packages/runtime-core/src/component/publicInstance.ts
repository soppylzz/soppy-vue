import type { Prettify } from "@soppy-vue/shared"
import { EMPTY_OBJ, extend, hasOwn } from "@soppy-vue/shared"
import type { ComponentInternalInstance, Data } from "./component"
import { getExposeProxy, isStatefulComponent } from "./component"
import type { ComponentBaseOptions } from "./options"
import type { EmitFn, EmitsOptions } from "./emits"
import { track } from "@soppy-vue/reactivity"
import { nextTick } from "../scheduler"

type ComponentPublicInstance<
  Props = {}, // origin: props type extracted from props option
  RData = {}, // return from data(), naming convention to distinguish Data
  Emits extends EmitsOptions = {},
  Options = ComponentBaseOptions<any, any, any>,
> = {
  $: ComponentInternalInstance
  $el: any

  $root: ComponentPublicInstance | null
  $parent: ComponentPublicInstance | null

  $data: RData
  $attrs: Data
  $props: Prettify<Props>

  // light: define normalize schema for emitsOptions
  $emit: EmitFn<Emits>

  $options: Options
}

/**
 * light: in official vue3, `ComponentPublicInstance` requires a `$options` type
 * that reuses some of the same generics as the proxy itself. Because mixins/extend
 * cause `$options` and the instance proxy to diverge, vue builds this for:
 * - flatten the generic surface
 * - provide a transformation seam
 */
type CreateComponentPublicInstance<
  Props = {},
  RData = {},
  Emits extends EmitsOptions = {},
  PublicProps = Props,
  PublicRData = RData,
> = ComponentPublicInstance<
  /**
   * official vue3: `PublicP = UnwrapMixinsType<PublicMixin, 'P'> & EnsureNonVoid<P>` due to mixin merging.
   * ours: identical in practice, separated only as a forward-compatible seam.
   */
  PublicProps,
  PublicRData,
  Emits,
  ComponentBaseOptions<Props, Emits, string>
>

export type { ComponentPublicInstance, CreateComponentPublicInstance }

function getPublicInstance(instance: ComponentInternalInstance | null) {
  if (!instance) return null
  if (isStatefulComponent(instance)) return getExposeProxy(instance) || instance.proxy
  return getPublicInstance(instance.parent)
}

type PublicPropertiesMap = Record<string, (i: ComponentInternalInstance) => any>
const publicPropertiesMap: PublicPropertiesMap = extend(
  // set publicPropertiesMap.prototype to null to avoid being affected by Object.prototype
  Object.create(null),
  {
    $: (i) => i,
    $el: (i) => i.vnode.el,

    // ensure $parent / $root must return the public proxy, not the internal instance
    $parent: (i) => getPublicInstance(i.parent),
    $root: (i) => getPublicInstance(i.root),

    $data: (i) => i.data,
    $props: (i) => i.props,
    $attrs: (i) => i.attrs,

    $emit: (i) => i.emit,

    $options: (i) => i.type,
  } as PublicPropertiesMap
)

const publicInstanceProxyHandler: ProxyHandler<any> = {
  get({ _: instance }, key: string) {
    const { ctx } = instance

    const publicGetter = publicPropertiesMap[key]

    if (publicGetter) {
      if (key === "$attrs") {
        track(instance, key)
      }
      return publicGetter(instance)
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      /**
       * by default, all prop on publicInstance are injected via the proxy, this `hasOwn(ctx, key)`
       * reads directly from ctx, instead of reading via proxy. this is to handle scenarios where
       * users modify `instance.ctx` directly
       */
      return ctx[key]
    }
  },
  set({ _: instance }, key: string, value) {
    const { data, ctx } = instance

    if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value
      return true
    } else if (hasOwn(instance.props, key)) {
      return false
    }

    if (key[0] === "$" && key.slice(1) in instance) {
      return false
    } else {
      // modify `instance.ctx` directly
      ctx[key] = value
    }

    return true
  },
}

export { publicInstanceProxyHandler, publicPropertiesMap }
