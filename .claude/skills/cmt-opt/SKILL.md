---
name: cmt-opt
description: 优化 read-vue 项目的源码阅读注释。将用户的中文感悟，对照 Vue 3.4 官方源码与本项目实现校验、指正错误，再按现有英文注释风格改写，输出英文注释。适用于 `packages/*/src` 下的源码注释撰写与润色。
---

# 源码阅读注释优化

你正在为 read-vue 项目编写或优化源码阅读注释。这类注释不是生产级 API 文档，而是**阅读笔记**——解释「为什么这么写」「官方 Vue 怎么做的」「这个 mini-build 简化了什么」。以下规范从 `packages/runtime-core/src` 现有注释中提取。

---

## 工作流程

收到用户的中文感悟后，按顺序执行四步：

1. **校验事实**：对照 Vue 3.4 官方源码（`vuejs/core`）与本项目实现，检查感悟中关于调度、响应式、diff 等机制的描述是否有误。
2. **指正错误**：发现错误时明确指出「正确机制是什么、为何感悟中的说法不成立」，再给出修正后的注释。
3. **改写文本**：按下方风格规范，把正确的内容改写成英文注释。
4. **输出英文注释**：最终交付物是可直接粘贴进源码的英文注释。

> 错误指正放在注释产出之前，二者都要给出；不要只给正确版本而隐瞒校验发现的问题。

---

## 注释风格规范

### 1. 标记前缀（annotation markers）—— 本项目注释的核心签名

用**小写 `tag:` 前缀**对注释分类，说明这条笔记的性质。前缀小写、紧跟冒号，冒号后句首**小写**：

| 前缀 | 含义 | 示例 |
| --- | --- | --- |
| `light:` | 本 mini-build 自己的实现选择：简化、取巧、偏离官方 | `// light: use non-null assertion to skip initial checks` |
| `origin:` / `origin comment:` / `origin code:` | 官方 Vue 源码的原始做法或原注释引用 | `// origin comment: no update needed. just copy over properties` |
| `self-design:` | 个人自定义的设计决策 | `// self-design: ensure coding style consistent` |
| `fixme:` | 已知问题 / 临时绕过，需说明原因 | `// fixme: comp.emits resolves to a union ... temporary as any bypass` |
| `todo:` | 待办 / 未处理的分支 | `// todo: consider whether to handle .once suffix` |
| `vue-special` | Vue 特有的特判，区别于标准算法 | `// vue-special implementation, to skip new mount vnode` |
| `breaking point:` | 概念 / 类型在此分叉 | `// breaking point: ComponentOptions is type specific to stateful components` |
| `commit tricky:` | 某个容易踩坑的决策点 | `// commit tricky: w/ === with, w/o === without` |

**使用原则**：标记前缀用于「需要归类的笔记」。解释某行代码做什么的纯说明性注释，不加前缀，直接小写陈述。

### 2. 注释形态与位置

- **单行 `//`**：说明紧邻其下方的一行 / 一段代码，放在**代码上方**。
- **块注释 `/** ... */`**：用于
  - 函数 / 接口的整体说明（目的、为何存在）；
  - 需要列表或跨多行的解释，内部用 `-` 分点；
  - 类型定义（如 `ComponentInternalInstance` 的字段说明，配 `@example`）。
- **章节横幅**：大文件用 `/* ==================== section ==================== */` 划分逻辑区块（如 `internal methods (text)`、`component define`、`vnode utils`），放在区块顶部。

### 3. 语言与语气

- **全部英文，句首小写，口语化、简短**。不追求完整句子语法，接近流水账式旁注。
- **代码符号用反引号**：`` `vnode.el` ``、`` `props.class` ``、`` `this: void` ``。
- **强调用 `**bold**`**：关键结论、对比项、被特判的对象 —— `**NOT** parent type`、`**this mini-build**`、`**`Fragment`**`。不用斜体。
- **`=>` 箭头写示例**：`<comp :count="'10'" /> => warns`。
- **`@example`**：配代码片段展示用法；**`@returns`**：说明返回值的语义。
- **解释「为什么」，不解释「是什么」**。默认读者看得懂代码，注释只补意图、取舍、与官方的差异。

### 4. 对比官方源码的惯例

本项目的注释强烈依赖「官方 vs 本实现」的对照叙事：

- 引用官方原注释时用 `origin comment:`，逐字保留或转述。
- 说明本项目做了简化 / 跳过时，用 `light:` 或 `our implementation ...` / `this mini-build ...` / `skips ... for simplicity`。
- 指出官方有而本项目没有的分支，即使该分支被省略，也保留其结构并注明：

```ts
/**
 * official vue3 splits instance creation from initialization, allowing
 * compat components to bypass `setupComponent` via `compatMountInstance`
 * **this mini-build** skips the compat implementation but keeps the branches structure
 */
```

- 解释官方用某 API 而本项目用替代方案时，点明原因：`official vue3 use shallowReactive here, use reactive for now`。

### 5. 检查清单

产出英文注释前，逐项自检：

- [ ] 用了合适的标记前缀？还是纯说明性注释（无前缀）？
- [ ] 句首小写、简短、口语化，不写「The function does...」式正式说明？
- [ ] 代码符号加了反引号？强调用了 `**bold**`？
- [ ] 涉及官方差异时，标了 `origin:` / `light:` / `our implementation`？
- [ ] 解释的是「为什么 / 取舍」，而非复述代码本身？
- [ ] 多行解释用了 `-` 分点，而不是一坨长句？

---

## 反例对照

```ts
// ❌ 正式、句首大写、复述代码
// The normalizeChildren function normalizes the children of the vnode.

// ❌ 有官方差异却未标注
// use reactive instead of shallowReactive

// ✅ 正确风格
// official vue3 use `shallowReactive` here, use `reactive` for now
```
