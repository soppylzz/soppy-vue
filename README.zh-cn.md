<h1 align="center"><img width="60%" src="./assets/wordmark.png" alt="soppy-vue"/></h1>

<p align="center">
  <a href="https://www.npmjs.com/package/soppy-vue"><img src="https://img.shields.io/npm/v/soppy-vue" alt="soppy-vue on npm" /></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6" alt="TypeScript" />
</p>

<div align="center">

[English](README.md) | [简体中文](README.zh-cn.md)

</div>

一个用 TypeScript 构建的小型 Vue-like 框架，用于探索 Vue 3.4 的响应式与渲染机制。可以安装已发布的包试用 API，也可以结合源码和教程学习实现过程。

## 特性

- 🧬 **最小的 Vue 实现** — 以最小代码重新实现响应式与运行时，遵循 Vue 的核心机制。
- 🟦 **TypeScript 友好** — 精确的类型推断与类型守卫，完整的 IDE 补全体验。
- **运行时测试** —— 使用 Vitest 用例覆盖运行时内部实现。
- 📖 **教程文档** — 从环境搭建、响应式到 Diff 算法的逐步拆解。

## 教程

源码导读位于 [`tutorials`](./tutorials)：

| 目录                                                     | 内容              |
| -------------------------------------------------------- | ----------------- |
| [`prepare`](./tutorials/tutorials/prepare/intro.md)      | 工程准备          |
| [`reactivity`](./tutorials/tutorials/reactivity/base.md) | Proxy 与 computed |
| [`runtime`](./tutorials/tutorials/runtime/intro.md)      | DOM 渲染与 diff   |

## 安装

安装已发布的包：

```bash
pnpm add soppy-vue
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

[MIT](./LICENSE)。
