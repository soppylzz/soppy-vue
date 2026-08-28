---
title: "Diff"
---

# Diff

Vue 的 `patchKeyedChildren` 负责在 patch 阶段处理 `vnode.children` 从数组到数组的更新。

### 1. LIS

进入第三阶段时，Vue 已经通过 `key → newIndex` 的哈希映射完成了节点复用判定。此时我们面对的问题不再是「哪些节点可以复用」（第一阶段的哈希表已经回答了），而是——在已确认复用的节点中，哪些已经处于正确的相对位置、不需要移动？

答案藏在 `newIndexToOldIndexMap` 里。这个数组的每个元素是该新 child 在旧 children 中的位置（`oldIndex + 1`，`0` 表示新增）。节点的「正确相对位置」等价于它们在 `newIndexToOldIndexMap` 中的值随新数组下标**严格递增**。因此，找到 `newIndexToOldIndexMap` 的 LIS——这些节点无需移动，其余按需 mount 或 move。

看到「diff」，很自然会想到 Git。但 Git 用 LCS，Vue 用 LIS——这不是随意选择：

|              | Git                               | Vue Diff                             |
| ------------ | --------------------------------- | ------------------------------------ |
| 核心职责     | 同时判定复用关系 + 给出 diff 结果 | 只负责「已复用节点中哪些有序」       |
| 复用判定方式 | LCS 自身决定哪些行匹配            | 哈希表 `key → newIndex` 提前完成匹配 |
| 操作代价     | 各行变更代价相等                  | DOM 操作中移动比创建/销毁更便宜      |

关键差异在第二行。Git 用 LCS 同时解决「谁匹配谁」和「怎么排」两个问题。而 Vue 在进入 LIS 之前，`isSameVNodeType` + key 匹配已经告诉了我们每个新节点对应哪个旧节点。LIS 只承担后半段——「沿用哈希表给出的复用关系，最大化不动节点」。

#### 🧶 Patience Sorting

LIS 的动态规划解法是 `O(n^2)`，如果使用 **Patience Sorting** 则可降到 `O(n*logn)` 。Vue 正是采用的这种实现方案。该方法可描述为一个单人纸牌游戏：

1. 从左到右发牌

   - 每张牌放入**最左边**堆顶 ≥ 该牌的牌堆；

   - 若不存在这样的堆，则在右侧新开一堆。

2. 最终堆数 = LIS 长度。

```
>> [3, 1, 4, 1, 5, 9, 2, 6]

3 → s1:[3]
1 → s1:[3,1]      (1 ≤ 3)
4 → s1:[3,1]      s2:[4]      (4 > 1, new stack)
1 → s1:[3,1,1]    s2:[4]      (1 ≤ 1)
5 → s1:[3,1,1]    s2:[4]      s3:[5]
9 → s1:[3,1,1]    s2:[4]      s3:[5]     s4:[9]
2 → s1:[3,1,1]    s2:[4,2]    s3:[5]     s4:[9]
6 → s1:[3,1,1]    s2:[4,2]    s3:[5]     s4:[9,6]
```

`stack.num = 4` => `LIS.length = 4`。正确性由 **Dilworth 定理**保证：

> 偏序集中最小链覆盖数 = 最大反链大小。每一堆内部的元素严格递减（一条链），堆数 = LIS 长度。

我们不必深究，只需记住结论：**patience sorting 的堆数 = LIS 长度**即可。

#### 🧵 Implementation

在学习 Vue 的 LIS 实现时，需注意如下两个重点：

1. **`if (curVal === 0) continue`**：`newIndexToOldIndexMap` 以 0 表示新增节点（复用节点的 `oldIndex + 1` >= 1）。新增节点在后续遍历中直接 mount，不需要考虑移动。

2. **`prev` 回溯重建序列**：

   Patience sorting 主体循环结束后，`pileTop` 存储的是每堆当前的顶部下标，但 `pileTop[-1]` <u>不一定</u>是真正 LIS 的尾部——后续发牌替换了堆顶后，被替换的旧堆顶才可能属于 LIS。

   此时的做法应该是，在排序过程中维护 `prev` 数组记录每个元素的前驱。循环结束后从最后一堆的堆顶沿 `prev` 回溯，重建完整的 LIS 下标序列，写回 `pileTop` 返回：

   ```ts
   curIdx = pileTop.length - 1
   curVal = pileTop[curIdx]

   while (curIdx > 0) {
     pileTop[curIdx] = curVal
     curVal = prev[curVal]
     curIdx--
   }
   ```

   > 回溯后的 `pileTop` 不再是「每堆的堆顶」，而是 LIS 中各位置的下标。函数名 `LIS` 暗示了这一点——它返回的就是 LIS 下标数组。

LIS 完整实现如下：

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

### 2. patchKeyedChildren

理解 LIS 之后回到 `patchKeyedChildren`。它的完整流程由三个连续的阶段串成：

#### 🌗 Sync header & tailer

对新旧 Vnode 列表，使用头尾双指针向中间收缩，`isSameVNodeType` 匹配则原地 patch，否则退出。

#### 🌖 Quick path

对新旧 Vnode 列表进行判断，某一方已经遍历完毕，直接批量 mount / unmount，提前返回。

#### 🌕 Main diff

对剩余区间建立 `key → newIndex` 映射，用 LIS 确定哪些复用节点无需移动。

1. 建立 `key → newIndex` 映射

2. 构建 `newIndexToOldIndexMap` 映射，这是我们可以通过判断 `maxNewIndexSoFar` 与当前处理的旧 VNode 节点的目标移动位置的关系（通过哈希表 / 遍历操作实现），得出当前 diff 中是否存在 VNode 移动的情况，从而对第三步剪枝。

3. 计算 LIS 并从后向遍历 `newIndexToOldIndexMap`，遍历时我们对 LIS 与 `newIndexToOldIndexMap` 进行如下比较：

   | 条件                             | 操作                |
   | -------------------------------- | ------------------- |
   | `newIndexToOldIndexMap[i] === 0` | 新节点 → mount      |
   | `i` 在 LIS 序列中                | 已在正确位置 → 跳过 |
   | `i` 不在 LIS 序列中              | 需要调整 → move     |

   > 反向遍历保证 anchor 指向的节点已经就位。`insertBefore(node, anchor)` 将 node 插到 anchor 之前——每次移动都安全，不会出现 anchor 尚未处理的竞态。

### Interview

### 1. v-for index & key

为什么 `v-for` 不推荐使用 `index` 作为 `key`？核心原因在于：`key` 用于标识数据项的**唯一身份**，而 `index` 标识的仅是**渲染位置**。当列表顺序发生变化时，位置会发生偏移，但数据本身的身份不应改变，二者语义不匹配。

#### 😲 Element

假设初始 DOM 元素列表为 `[A, B, C]`，随后在头部插入 `D`，新列表变为 `[D, A, B, C]`：

| key | old  | new |
| --- | ---- | --- |
| 0   | A    | D   |
| 1   | B    | A   |
| 2   | C    | B   |
| 3   | null | C   |

Vue 通过 `isSameVNodeType` 判断是否可以复用 VNode。由于 `key` 未变，Vue 会认为前三个位置的 VNode 仍是旧节点，从而**直接复用原有的 DOM 元素**。

```ts
function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
```

这会导致两个层面的问题：

- **DOM 状态错位**：原本属于 `A` 的 DOM 元素（如 `<input>` 的输入框内容）被 `D` 复用。对于表单控件等具有内部状态的 DOM，会出现明显的状态错乱。
- **无效的性能开销**：若 `D/A/B` 的 `vnode.props` 不同，Vue 在更新时会强制进行 DOM Diff 和 patchProps，无法走高效的复用短路逻辑，反而降低了渲染性能。

可通过以下示例验证上述问题：

```vue
<script setup lang="ts">
import { ref } from "vue"

const profiles = ref([
  { name: "soppy", status: "happy" },
  { name: "foo", status: "unknown" },
  { name: "bar", status: "unknown" },
])

function insert() {
  profiles.value.unshift({
    name: "lzz",
    status: "sleepy",
  })
}
</script>

<template>
  <div>
    <template v-for="({ name, status }, index) in profiles" :key="index">
      <div :class="`is-${status}`">{{ name }}<input /></div>
    </template>
    <button @click="insert">INSERT</button>
  </div>
</template>

<style scoped>
.is-happy {
  color: red;
}
.is-sleepy {
  color: steelblue;
}
.is-unknown {
  color: gray;
}
</style>
```

#### 😰 Component

在组件场景下，问题更为严重。Vue 会**复用原有的组件实例**仅更新其 props。如果组件内部维护了 `ref`、本地 DOM 状态或非响应式的缓存数据，这些状态将保留在错误的组件实例上，导致数据逻辑混乱，且难以排查。
