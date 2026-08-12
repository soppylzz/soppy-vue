## Proxy

> 处理 `target[key]` 无法处理依赖收集的问题

Vue 3 的响应式系统基于 `Proxy` 实现。在使用 `Proxy` 代理对象时，如果对象内部存在依赖 `this` 的 `getter` 等访问逻辑，就需要特别关注 `this`的指向问题。例如：

```ts
const person = {
  name: "soppylzz",
  get greet() {
    return `my name is ${this.name}`
  },
}

const personProxy = new Proxy(person, {
  get(target, key, recevier) {
    return target[key] // this -> person
  },
})

console.log(personProxy.greet)
```

这段代码表面看起来没有问题，但实际执行 `target[key]` 时，`greet` 的 `getter` 会以 `target`（即原始对象 `person`）作为调用者执行。此时 `this === person`，访问的是 `person.name`，而非代理对象上的属性。由于 `name` 的访问并未经由 `Proxy`，也就**无法触发依赖收集**，这显然不符合 Vue 3 响应式系统的设计预期。

一个直观的改进思路是改为返回 `receiver[key]`，但这样会再次触发当前代理对象的 `get` 拦截，导致无限递归，最终引发栈溢出。为此，Vue 3 源码中没有直接使用 `target[key]`，而是借助 `Reflect.get` 来解决：

```ts
const mutableHandler: ProxyHandler<any> = {
  get(target, key, receiver) {
    return Reflect.get(target, key, receiver)
  },
}
```

`Reflect.get` 的三个参数含义如下：

| 参数       | 含义                                                         |
| ---------- | ------------------------------------------------------------ |
| `target`   | 被读取属性的目标对象                                         |
| `key`      | 要读取的属性名                                               |
| `receiver` | 当读取的是 `getter` 属性时，用作 `getter` 内部的 `this` 指向 |

使用 `Reflect.get` 后，外层读取 `greet` 时仍以 `person` 为属性来源，不会触发无限递归；而 `getter` 内部的 `this` 则指向 `personProxy`，从而对 `name` 的访问也能被拦截，为后续的依赖收集打下正确基础。
