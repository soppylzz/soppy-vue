import type { LooseRequired } from "@soppy-vue/shared"
import type { VNodeChild } from "../vnode"
import type { Component, SetupContext } from "./component"
import type { CreateComponentPublicInstance } from "./publicInstance"
import type { EmitsOptions } from "./emits"
import type { RuntimeFlags } from "../constant"

type RenderFunction = () => VNodeChild

type ComponentBaseOptions<
  Props,
  /**
   * light: in official vue3, emits use generics(`EE`, `E`) to specify the type of emits,
   * where `EE` is used to address the issue of weak resolution for `string[]`
   * we only change those generics name to more semantic ones
   */
  BEmits extends EmitsOptions,
  SEmits extends string = string,
> = {
  // light: use `this: void` to disable `this` using in setup block
  setup?: (
    this: void,
    props: LooseRequired<Props>,
    ctx: SetupContext<BEmits>
  ) => RenderFunction | Props
  name?: string
  render?: Function
  /**
   * local components registry. maps tag names to component definitions,
   * used by `resolveComponent()` to resolve child components at render time.
   */
  components?: Record<string, Component>
  emits?: (BEmits | SEmits[]) & ThisType<void>

  /**
   * self-design: official vue3 extended `LegacyOptions` here, which
   * carried vue2 API types. that caused `comp.props` to be resolved
   * through `[key: string]: any` — losing type precision entirely.
   */
  props?: any
  [RuntimeFlags.IS_KEEP_ALIVE]?: boolean
}

type ComponentOptions<
  Props = {},
  RData = any,
  Emits extends EmitsOptions = any,
> = ComponentBaseOptions<Props, Emits, string> &
  ThisType<
    CreateComponentPublicInstance<
      /**
       * light: using `{}` here breaks the cycle by deferring full prop inference
       * prevent infinite recursion: ComponentOptions -> ComponentPublicInstance -> ComponentOptions ...
       */
      {},
      RData,
      Emits,
      /**
       * light: `Readonly<Props>` feeds precise prop types into `ComponentPublicInstance`,
       * enabling autocomplete + mutation protection on `$props` / `this.$props`.
       */
      Readonly<Props>
    >
  >

export type { ComponentBaseOptions, ComponentOptions, RenderFunction }
