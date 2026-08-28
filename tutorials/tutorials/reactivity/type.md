---
title: "Unwrap"
---

# Unwrap

`ref` 与 `reactive` 在嵌套使用时涉及两个关键场景，它们直接决定了 `Ref<T>`、`Reactive<T>` 的类型工具设计：

- `ref(val: Ref)` — 传入一个已有的 Ref
- `reactive({ nested: { withRef: Ref } })` — Reactive 对象内部嵌套了 Ref

在实现泛型工具之前，先理清运行时的实际行为，再反过来推导类型设计。

### 1. JavaScript Unwrap

解包在运行时分两处发生：`mutableHandler` 中的代理拦截，以及 `createRef` 中的短路处理。

#### 🍭 mutableHandler

我们希望当 Reactive 代理对象中存在 Ref 时，可以直接通过 GET / SET Reactive 对象的对应属性同步更改原本的 Ref 对象。为此，我们可以在 `mutableHandler` 中对类型为 Ref 的值进行特殊处理：

```ts
const mutableHandler: ProxyHandler<NonNullObject> = {
  get(target, key, receiver) {
    track(target, key)
    const value = Reflect.get(target, key, receiver)

    if (isRef(value)) {
      return value.value // collect deps via ref implement
    }

    return isObject(value) ? reactive(value) : value
  },
  set(target, key, newVal, receiver) {
    const oldVal = target[key]

    if (isRef(oldVal)) {
      oldVal.value = newVal // change dispatch via ref implement
      return true
    }

    const result = Reflect.set(target, key, newVal, receiver)
    if (oldVal !== newVal) {
      trigger(target, key)
    }
    return result
  },
}
```

#### 🍬 createRef

当我们使用 `ref` 的嵌套代理时，我们希望避免重复代理，这与 `reactive` 的内部逻辑一致。

```ts
function createRef(value: unknown) {
  if (isRef(value)) {
    return value
  }
  return new RefImpl(value)
}
```

`reactive` 的返回值在类型结构上与原始对象一致，不会因为嵌套层级而产生额外的包装层。但 `ref` 的返回值有一个 `{ value }` 包装，因此我们必须在它的返回类型上添加额外的泛型处理。

---

这两个行为决定了泛型工具的两个关键约束：

1. Reactive 对象**内部属性**如果是 ref，类型上需要自动解包
2. `Ref<infer V>` 中的 `V` 永远不会是 Ref ——不会出现 `Ref<Ref<T>>`

### 2. UnwrapNestedRefs & UnwrapRefSimple

为 `reactive` 的返回值设计类型时，我们需要描述「对象内部嵌套的 Ref 会被解包」这一行为，这有两种思路：

- **整体匹配**：`type OneSolution<T> = T extends Reactive<infer V> ? V extends ?`，这种思路尝试用一个泛型从整体结构描述混合了 `Record<SomeKeys, Ref>` 的待解包对象。

- **值匹配**：这种情况下我们不用考虑键与值的关系，只需要考虑值是如何被解包的：

  ```ts
  type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

  type UnwrapRefSimple<T> = T extends BaseTypes | Ref | { [RawSymbol]?: true }
    ? T
    : T extends object
      ? {
          [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
        }
      : T
  ```

这里讨论一下几种特殊情况，以及 `UnwrapNestedRefs` 和 `UnwrapRefSimple` 的设计思路。

#### 😆 target

> 根据 `reactive` 的设计原型，其入口参数 `target` 只能为对象类型。

如果我们要对 Ref 类型的 `target` 进行解包，就必须考虑其原始类型是 **引用类型** / **值类型** ，然后再在`createReactiveObject` 做额外处理。与其做这样的处理，不如规定执行时将 `target: Ref` 作为普通对象处理。

#### 😲 recursive unwrap

一个多层嵌套 `target` 如果其中一个 Value 为对象，那么这个对象必然要经过 `reactive` 代理，它也是一个 `target`，因此我们也需要在遇到 Ref 类型时跳出递归解包。当然这个 Value 还有可能为其他类型，我们也需要在 `UnwrapRefSimple` 中处理。

不难发现 `UnwrapNestedRefs` 实际上就是入口收窄的 `UnwrapRefSimple`，因为 `reactive` 的入口约束已经帮我们排除了非对象类型：

- `UnwrapNestedRefs<T>`：针对 `target` 为对象的泛型解包工具
- `UnwrapRefSimple<T>`：针对 `value` 的泛型解包工具

### 3. UnwrapRef

我们真正对 Ref 值的解包处理是在 `UnwrapRef` 中。由于 `RefImpl` 中是采用 `reactive` 实现对对象的代理，因此在这里我们可以复用 `UnwrapRefSimple`：

```ts
type UnwrapRef<T> = T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>
```

## Type Guard

类型守卫用于判别一个未知值是否为响应式对象。在运行时层面，`isRef` 和 `isReactive` 都通过 `ReactiveFlags` 标记来进行判别，但它们的**类型标注**策略却截然不同。

在深入两个函数的设计之前，我们有必要先理清对 `any`、`unknown`、`is` 的认识：

- `any`：当我们使用 `any` 标注变量时，该变量会接受所有类型，同时放弃对它的类型检查。

- `unknown`：相当于「类型安全」版的 `any`。当我们使用 `unknown` 标注一个变量时，我们表示它可能是任何类型——「我不知道它是什么类型」。不同于 `any`，在使用前我们必须通过 Narrowing<sup>「剪枝」</sup>将其收窄到具体类型：

  ```ts
  function guard(input: unknown) {
    if (typeof input === "string") {
      console.log(input.trim()) // 剪枝后 input 被收窄为 string
    }
  }
  ```

  `unknown` 和 `any` 都能接受所有类型作为入参，但 `unknown` 强制调用方在使用值之前完成类型判别——这与类型守卫「先判断，后使用」的语义天然契合。

- `is`：声明类型谓词，语法为 `param is Type`。它告诉 TypeScript：「如果这个函数返回 `true`，那么参数的类型就可以收窄为 `Type`」。

### 1. isRef

先整理设计背景。在此之前的 `createRef` 通过短路返回逻辑保证了 `ref` 接受一个已有的 Ref 或基本类型，始终转换为 `Ref<UnwrapRef<T>>`——Ref 的包装永远只有一层。这为类型推导提供了干净的前提：`Ref<infer V>` 可以安全地一路推导到底，不会碰到 `Ref<Ref<...>>` 的死循环。

```ts
function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
function isRef(r: any): r is Ref {
  return !!(r && r[ReactiveFlags.IS_REF] === true)
}
```

简述一下这里函数重载的设计亮点：

- `Ref<T> | unknown` 联合类型的第一个分支 `Ref<T>` 携带了 `T` 的位置信息。TypeScript 在重载解析时会尝试将实参与 `Ref<T>` 的结构匹配，一旦匹配成功，`T` 就绑定到具体的类型参数上，守卫后的结果 `Ref<T>` 携带了完整的泛型精度。而 `unknown` 则负责接收剩余的所有类型，两个分支组合起来的接收面覆盖了所有可能的入参。
- 如果实参本身已经是 `any`，TypeScript 则会跳过第一个重载签名，直接落入实现签名 `isRef(r: any): r is Ref`，此时 `T` 回退为 `Ref` 的默认泛型 `any`。

### 2. isReactive

`isReactive` 的返回类型只有 `boolean`，没有类型谓词。为什么不能仿照 `isRef` 声明为 `value is Reactive<T>`？

```ts
function isReactive(value: unknown): boolean {
  return !!((value as any)[ReactiveFlags.IS_REACTIVE] === true)
}
```

#### 🌫️ Info missing

回到上一节对 `isRef` 的分析——它能够推断 `T`，是因为入参 `Ref<T> | unknown` 中的 `Ref<T>` 分支提供了泛型槽位。`T` 内嵌在一个结构已知的容器 `{ value: T, [RefSymbol]: true }` 中，TypeScript 可以从实参的 `.value` 成员反向匹配出 `T`。

`Reactive<T>` 的情况则完全不同。如果硬套同样的模式：

```ts
function isReactive<T>(value: Reactive<T> | unknown): value is Reactive<T>
```

`Reactive<T>` 的定义是 `UnwrapNestedRefs<T> & {}`，它是一个条件类型的映射结果，而非 `Ref<T>` 那样的独立包裹结构。TypeScript 在面对一个 `unknown` 实参时，无法将其结构反推为「某对象的 UnwrapNestedRefs」。`T` 永远无法被推断，守卫的泛型部分形同虚设。

即便忽略推断问题，假设能拿到 `T`，类型谓词 `value is Reactive<T>` 对大多数对象也不会产生有意义的收窄——`Reactive<T>` 展开后，对于不含 Ref 属性的普通对象（如 `{ name: string }`），结果就是对象本身，守卫前后类型完全等价。

> 类型谓词的价值取决于守卫带来的**新结构信息**。`Ref<T>` 多了 `.value`，`Reactive<T>` 什么也没多——这就是 `isRef` 使用 `is` 而 `isReactive` 不使用的本质原因。

#### 🫠 Any collapse

那么退一步，降低颗粒度——不推断 `T`，直接使用 `Reactive<any>` 作为谓词目标呢？

```ts
function isReactive(value: any): value is Reactive<any> {}
// Reactive<any>
// => UnwrapNestedRefs<any> & {}
// => any extends Ref ? T : UnwrapRefSimple<any>
// => UnwrapRefSimple<any>
// => any & {}
// => any
```

`Reactive<any>` 直接坍缩为 `any`。`value is Reactive<any>` 等价于 `value is any`——和没做守卫没有任何区别。

#### 🏁 Compromise

综上，`isReactive` 的折衷版本为：

```ts
function isReactive(value: unknown): boolean
```
