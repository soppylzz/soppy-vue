<h1 align="center"><img width="60%" src="./assets/wordmark.png" alt="soppy-vue"/></h1>

<p align="center">
  <a href="https://www.npmjs.com/package/soppy-vue"><img src="https://img.shields.io/npm/v/soppy-vue" alt="soppy-vue on npm" /></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6" alt="TypeScript" />
</p>

<div align="center">

[English](README.md) | [简体中文](README.zh-cn.md)

</div>

A small Vue-like framework built in TypeScript to explore Vue 3.4's reactivity and rendering concepts. Install the published package to try the API, or follow the source and tutorials to study its implementation.

## Features

- 🧬 **A minimal Vue** — re-implements reactivity and runtime with minimal code, following the core mechanisms of Vue.
- 🟦 **TypeScript friendly** — precise type inference and type guards, with full IDE completion support.
- **Runtime tests** — Vitest specs covering the runtime internals.
- 📖 **Tutorial docs** — step-by-step breakdown from environment setup, reactivity to the Diff algorithm.

## Tutorials

The source walkthrough lives in [`tutorials`](./tutorials):

| Directory                                                | Content                   |
| -------------------------------------------------------- | ------------------------- |
| [`prepare`](./tutorials/tutorials/prepare/intro.md)      | Engineering setup         |
| [`reactivity`](./tutorials/tutorials/reactivity/base.md) | Proxy and computed        |
| [`runtime`](./tutorials/tutorials/runtime/intro.md)      | DOM rendering and diffing |

## Installation

Install the published package:

```bash
pnpm add soppy-vue
```

### CDN

You can directly import it via [unpkg](https://unpkg.com/soppy-vue) / [jsdelivr](https://cdn.jsdelivr.net/npm/soppy-vue) as an IIFE bundle that exposes the global `SoppyVue`:

```html
<script src="https://unpkg.com/soppy-vue/dist/index.js"></script>
```

## Packages

This is a pnpm monorepo. The framework is split into several packages, mirroring the structure of the Vue source code:

| Package                                              | Description                          |
| ---------------------------------------------------- | ------------------------------------ |
| [`soppy-vue`](./packages/soppy-vue)                  | Public entry, re-exports the runtime |
| [`@soppy-vue/runtime-dom`](./packages/runtime-dom)   | Browser DOM renderer                 |
| [`@soppy-vue/runtime-core`](./packages/runtime-core) | Platform-agnostic renderer           |
| [`@soppy-vue/reactivity`](./packages/reactivity)     | Reactivity system                    |
| [`@soppy-vue/shared`](./packages/shared)             | Shared utilities                     |

## License

[MIT](./LICENSE).
