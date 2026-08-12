---
name: docs-style
description: 规范 Vue 源码教程(`./tutorials/`)的写作风格。涵盖叙事结构、章节组织、代码引用、语言风格及特有惯例。适用于 read-vue 项目的文档撰写与润色，确保教程具备一致性、可读性与源码级深度。
---

# Vue 源码教程写作风格规范

你正在为 read-vue 项目编写或修改教程文档（`tutorials/` 目录下）。以下规范从现有全部教程中提取，覆盖叙事结构、代码引用、语言选词、图表使用、以及 Vue 源码讲解的特有惯例。

---

## 一、叙事结构

### 1. 每章开头先交代「目的」或「为什么需要它」

不直接进入实现细节。先用 1–2 句说明这段内容存在的理由、它要解决什么问题。读者需要先建立心理锚点，再理解细节。

```
✅ (runtime/intro.md)
Vue 的运行时模块由 runtime-core 和 runtime-dom 两个子包组成。它们之间通过依赖注入解耦。

✅ (reactivity/base.md)
Vue 3 的响应式系统基于 Proxy 实现。在使用 Proxy 代理对象时，如果对象内部存在依赖 this 的 getter...就需要特别关注 this 的指向问题。

❌
下面我们来看运行时模块。
```

### 2. 渐进式深入：直觉 → 原理 → 源码

复杂概念不一次性抛出来。先给直观理解或生活化比喻，再给形式化定义/源码，最后给边界讨论。例如 `type.md` 中讲解 `isRef` 泛型设计时，先整理了 `createRef` 的短路逻辑前提，再推导类型工具，再讨论边界塌缩。

### 3. 分阶段 / 分步骤叙述

对于流程类内容，用编号列表或显式阶段划分来降低读者的认知负载：

```
算法分两个阶段：
1. 头尾同步...
2. 中间乱序...
```

```
ci.md 中将 Linter 章节拆为：
1. Eslint → Language → Processors → Example (递进式子章节)
2. Commitlint
```

### 4. 「痛点驱动」而非「功能罗列」

不写「Vue 支持 X 功能」，而是「旧方案有什么痛点 → Vue 怎么解决 → 源码怎么实现」。这在 `type.md`、`base.md`、`intro.md` 中贯穿始终。

```
✅ (reactivity/base.md)
这段代码表面看起来没有问题，但实际执行 target[key] 时...无法触发依赖收集，
这显然不符合 Vue 3 响应式系统的设计预期。

一个直观的改进思路是改为 receiver[key]，但这样会...导致无限递归。
为此，Vue 3 源码中借助 Reflect.get 来解决。
```

---

## 二、标题与章节组织

### 1. H2 (`##`) 为章标题，H3 (`###`) 为节标题，H4 (`####`) 为例/细节

层级严格，不跨级。H3 是主要叙事单元，H4 用于补充性子话题或具体示例。

### 2. Emoji 做小节视觉锚点

用 emoji 标记同类小节，提升扫描效率。同一个 H3 标题下只用一个 emoji，放在标题开头：

```md
#### 🧶 Patience Sorting

#### 🧵 Implementation

#### 🌔 Languages

#### 🌕 Processors

#### 🌖 Example

#### 🍭 mutableHandler

#### 🍬 createRef

#### 😆 target

#### 😲 recursive unwrap

#### 🌫️ Info missing

#### 🫠 Any collapse

#### 🏁 Compromise
```

注意 emoji 选取的规律：同一篇文档中的同层级小节使用同类型 emoji（如 `type.md` 的境界用表情 😆😲🌫️🫠🏁），形成视觉节奏。

---

## 三、代码引用方式

### 1. 代码中注释一律采用英文编写

```ts
function LIS(arr: number[]): number[] {
  // prev[i] = predecessor index of `i` in a LIS, later to fill
  const prev = arr.slice()

  // this is the "top card" of each pile in Patience Sorting
  const pileTop = [0]

  let curIdx, curVal, left, right

  for (curIdx = 0; curIdx < arr.length; curIdx++) {
    curVal = arr[curIdx]

    // vue-special implementation, to skip new mount vnode
    if (curVal === 0) continue

    // case 1: current value is larger than all pile tops, build new pile
    const lastPileTop = pileTop[pileTop.length - 1]
    if (arr[lastPileTop] < curVal) {
      prev[curIdx] = lastPileTop
      pileTop.push(curIdx)
      continue
    }

    // case 2: find the **leftmost** pile where top >= curVal
    left = 0
    right = pileTop.length - 1
    while (left < right) {
      const mid = (left + right) >> 1
      if (arr[pileTop[mid]] < curVal) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    if (curVal < arr[pileTop[left]]) {
      pileTop[left] = curIdx
      if (left > 0) {
        prev[curIdx] = pileTop[left - 1]
      }
    }
  }

  /**
   * backtrack to reconstruct one LIS from predecessor pointers
   * remove the useless `pileTop[i]` from subsequent updates
   */
  curIdx = pileTop.length - 1
  curVal = pileTop[curIdx]

  while (curIdx > 0) {
    pileTop[curIdx] = curVal
    curVal = prev[curVal]
    curIdx--
  }

  return pileTop
}
```

### 2. 只在代码片段的关键节点添加注释，且放在关键行的上方

注释的风格是**完整的陈述句**，不是关键词堆砌或者源文件的逐行复制。代码片段是带注释的核心逻辑提取。省略与当前讲解无关的分支、错误处理、边界条件。只在代码执行的关键节点或者易混淆节点添加注释。

### 3. 表格解释函数参数 / API 签名

当需要解释函数参数时，用表格而非文字逐条罗列：

```
| 参数       | 含义                                              |
| ---------- | ------------------------------------------------- |
| target     | 被读取属性的目标对象                              |
| key        | 要读取的属性名                                    |
| receiver   | 当读取的是 getter 属性时，用作 getter 内部的 this |
```

### 4. 代码块内嵌注释展示运行时状态

`point.md` 中独有一种写法——在代码块中用 `@state`、`@progress`、`@warn` 等注释标签来标注运行时状态变化：

```ts
/**
 * @state render.deps: [count, double]
 * @state count.dep: { render, double.effect }
 */
setTimeout(() => {
  count.value++
  /**
   * @progress render.dirty = true
   * @warn won't trigger render effect update
   */
}, 1000)
```

这种写法适用于**调试 / 踩坑类**内容，用于展示「错误是怎么产生的」执行流程追踪。常规讲解不需要。

---

## 四、语言风格

### 1. 中文叙述为主，英文术语不翻译

`patchKeyedChildren`、`insertBefore`、`mount`、`unmount`、`getter`、`Proxy`、`Ref`、`Reactive` 保持原样。它们是源码中的实际符号名，翻译反而增加认知负担。

唯一例外：偶尔用小括号注释首次出现的术语 — `Flag Configuration<sup>「扁平配置」</sup>`。

### 2. 第一人称「我 / 我们」

教程使用第一人称叙述，且区分两种语气：

- **「我」**：表达作者的个人判断、取舍原因、使用心得

  ```
  我使用 nvm 来管理不同项目使用的 Node 版本。
  因为以下原因我放弃了该方案。
  ```

- **「我们」**：引导读者一起做某件事，或表达项目约定
  ```
  我们需要先编写 pnpm-workspace.yaml 配置...
  我们一般使用 Commitlint 不需要进行复杂的配置...
  ```

### 3. 口语化的转折引导

用反问引出原因、用转折引入注意点，制造对话感：

```
为什么不能仿照 isRef 声明为 value is Reactive<T>？
需要注意，Monorepo 架构 != 多包发布。
表面看起来没有问题，但实际执行 target[key] 时...
```

### 4. 上标注释 `<sup>` + 引用块 `>` 做旁注

```md
Eslint 在 v9 引入了全新的 Flag Configuration<sup>「扁平配置」</sup> 模式

> 错误观点：我们用的是 Monorepo，所以一定是多包发布❌。

> 类型谓词的价值取决于守卫带来的**新结构信息**。Ref<T> 多了 .value，Reactive<T> 什么也没多...
```

`>` 引用块用于两种场景：

- 补充性注释——不打断正文，但需要 highlight
- 点睛结论——放在一大段分析之后，一句话收束

### 5. 英文专有名词大小写

- **文件名、目录名**：保持原样 — `package.json`、`node_modules`、`.zshrc`
- **工具名**：首字母大写 — `Prettier`、`Eslint`、`Commitlint`、`TypeScript`、`Javascript`
- **配置项**：代码字体 — `shamefully-hoist`、`shell-emulator`、`proseWrap`
- **命令行参数**：代码字体 — `--filter`、`--workspace`、`-w`
- **Git 术语**：首字母大写缩写 — `Git Hooks`、`Git Staged`

### 6. 强调格式

- **加粗** `**text**`：用于关键结论、首次引入的核心概念、以及「痛点 → 方案」转变处的关键词
- `<u>下划线</u>`：使用极少，仅见于 `runtime/intro.md` 中强调位运算的复合含义
- `行内代码`：用于变量名、函数名、配置值、命令
- ❌ 不使用斜体作为强调

---

## 五、图表与 ASCII 图示

### 1. ASCII 树形图展示架构层级

```
soppy-vue
└─ @soppy-vue/runtime-dom
    └─ @soppy-vue/runtime-core
        └─ @soppy-vue/reactivity
```

```
EventTarget
└─ Node
    ├─ Document
    ├─ CharacterData
    │   ├─ Text
    │   └─ Comment
    ├─ DocumentFragment
    └─ Element
        ├─ HTMLElement
        └─ SVGElement
```

### 2. 表格的使用场景

表格出现在以下场景：

| 场景              | 示例                                             |
| ----------------- | ------------------------------------------------ |
| 多方案对比/权衡   | LCS vs LIS 的代价对比；Vue 2 vs Vue 3 slots 差异 |
| 函数参数/API 解释 | `Reflect.get` 的三个参数                         |
| 节点类型枚举      | Node.nodeType 对照表                             |
| 命令速查          | Pnpm Monorepo 常用命令表                         |
| 版本特性差异      | Eslint v8 vs v9 配置差异                         |

---

## 六、Vue 源码讲解的特有惯例

### 1. 以源码函数 / 接口为叙事单位

教程的叙事单位是 Vue 源码中的具体函数或接口，每个函数一个小节。例如 `isSameVNodeType`、`normalizeVNode`、`LIS`、`isRef`、`isReactive`、`mutableHandler`。

### 2. 「特判」必须标出并解释业务原因

Vue 源码中与标准实现不同的特殊处理，单独标出并解释：

```
Vue 特判: 0 表示新增节点（在旧列表中不存在），不参与 LIS

如果我们要对 Ref 类型的 target 进行解包，就必须考虑其原始类型是引用类型/值类型...
与其做这样的处理，不如规定执行时将 target: Ref 作为普通对象处理。
```

### 3. 类型系统讲解先梳理运行前提

`type.md` 的独特模式：讲 TypeScript 泛型工具前，先讲运行时行为是什么，再讲类型如何建模这个行为。类型是运行时的「忠实映射」，不反过来。

```
在实现泛型工具之前，先理清运行时的实际行为，再反过来推导类型设计。
这两个行为决定了泛型工具的两个关键约束：
1. ...
2. ...
```

### 4. 「面试考点」自成体系

Interview / 面试相关章节可以独立成章，不必与正文保持相同粒度。从源码级给出精确回答，用源码中的变量名和逻辑作为论据。

---

## 七、不需要检查的内容

以下属于作者个人风格的一部分，可能在后续写作中不一致，不做强制要求：

- Emoji 的具体选择
- 四个空行 vs 两个空行分隔大章节
- `[TEMP]` 占位标记（表示该章节待补充，非风格规范）
