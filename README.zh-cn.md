<h1 align="center"><img width="35%" src="./assets/wordmark.png" alt="soppy-vue" /></h1>

基于 `vue@3.4` 的源码阅读项目，旨在从零构建一个 Vue-like 的实现。

## 特性

- 🧬 **最小的 Vue 实现** — 以最小代码重新实现响应式与运行时，遵循 Vue 的核心机制。
- 🟦 **TypeScript 友好** — 精确的类型推断与类型守卫，完整的 IDE 补全体验。
- 🤖 **Agent 驱动测试** — vitest 用例覆盖运行时内部实现。
- 📖 **教程文档** — 从环境搭建、响应式到 Diff 算法的逐步拆解。

## 教程

构建流程与源码分析位于 `/tutorials` 目录下，按构建流程组织成章节：

| 目录                    | 内容                          |
| ----------------------- | ----------------------------- |
| `/tutorials/prepare`    | 工程准备（环境、Lint、CI/CD） |
| `/tutorials/reactivity` | 响应式系统（Proxy、Computed） |
| `/tutorials/runtime`    | 运行时（DOM、Diff）           |

## 安装

可以通过 npm / pnpm / yarn 安装：

```bash
npm install soppy-vue
pnpm add soppy-vue
yarn add soppy-vue
```

### CDN

也可以通过 [unpkg](https://unpkg.com/soppy-vue) / [jsdelivr](https://cdn.jsdelivr.net/npm/soppy-vue) 直接引入 IIFE 产物，其暴露全局变量 `SoppyVue`：

```html
<script src="https://unpkg.com/soppy-vue/dist/index.js"></script>
```

## 包

这是一个 pnpm monorepo。框架被拆分为多个包，与 Vue 源码结构保持一致：

| 包                                                   | 描述                     |
| ---------------------------------------------------- | ------------------------ |
| [`soppy-vue`](./packages/soppy-vue)                  | 公共入口，重新导出运行时 |
| [`@soppy-vue/runtime-dom`](./packages/runtime-dom)   | 浏览器 DOM 渲染器        |
| [`@soppy-vue/runtime-core`](./packages/runtime-core) | 平台无关的渲染器         |
| [`@soppy-vue/reactivity`](./packages/reactivity)     | 响应式系统               |
| [`@soppy-vue/shared`](./packages/shared)             | 共享工具                 |

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。
