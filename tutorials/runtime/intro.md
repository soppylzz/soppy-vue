## Runtime

Vue 的运行时模块由 `runtime-core` 和 `runtime-dom` 两个子包组成。它们之间通过依赖注入解耦：

- **`runtime-dom`**：按照 `RendererOptions<HostElement, HostNode>` 接口提供浏览器 DOM 专属的渲染操作（`nodeOps` + `patchProp`）。
- **`runtime-core`**：消费 `RendererOptions` 接口，执行与平台无关的渲染逻辑——VNode 创建、patch、diff、组件挂载等。

```
soppy-vue
 └─ @soppy-vue/runtime-dom				=> 浏览器 DOM 操作
     └─ @soppy-vue/runtime-core 	=> 渲染逻辑
         └─ @soppy-vue/reactivity => 响应式系统
```

这种分层设计让 Vue 可以在不修改 `runtime-core` 的前提下，通过实现不同的 `RendererOptions` 适配到其他平台。下面介绍一下 Runtime 模块中较为重要的设计与 API。

## Optimize

### 1. Bitwise Operation

Vue 使用**位运算**在 VNode 上标记节点类型和更新类型（`shapeFlag` & `patchFlag`），避免在热路径中使用字符串比较：

```ts
enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,
  STATEFUL_COMPONENT = 1 << 2,
  TEXT_CHILDREN = 1 << 3,
  ARRAY_CHILDREN = 1 << 4,
  // ...
  COMPONENT = FUNCTIONAL_COMPONENT | STATEFUL_COMPONENT, // composite flag
}
```

以 `shapeFlag` 为例，用一个 `number` 字段同时描述节点<u>自身类型</u>和 <u>children 类型</u>，一次赋值即可：

```ts
// store multiple state
vnode.shapeFlag = ShapeFlags.ELEMENT | ShapeFlags.ARRAY_CHILDREN

// check only once
if (shapeFlag & ShapeFlags.ELEMENT) {
  // ...
}
```
