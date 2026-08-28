<h1 align="center"><img width="35%" src="./assets/wordmark.png" alt="soppy-vue" /></h1>

A source code reading project based on `vue@3.4`, aiming to build a Vue-like implementation from scratch.

## Features

- 🧬 **A minimal Vue** — re-implements reactivity and runtime with minimal code, following the core mechanisms of Vue.
- 🟦 **TypeScript friendly** — precise type inference and type guards, with full IDE completion support.
- 🤖 **Agent-driven tests** — vitest specs covering the runtime internals.
- 📖 **Tutorial docs** — step-by-step breakdown from environment setup, reactivity to the Diff algorithm.

## Tutorials

The build process and source code analysis are located in the `/tutorials` directory, organized into chapters following the build workflow:

| Directory               | Content                              |
| ----------------------- | ------------------------------------ |
| `/tutorials/prepare`    | Engineering Setup (Env, Lint, CI/CD) |
| `/tutorials/reactivity` | Reactivity System (Proxy, Computed)  |
| `/tutorials/runtime`    | Runtime (DOM, Diff)                  |

## Installation

You can install via npm / pnpm / yarn:

```bash
npm install soppy-vue
pnpm add soppy-vue
yarn add soppy-vue
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

This project is licensed under the [MIT LICENSE](./LICENSE).
