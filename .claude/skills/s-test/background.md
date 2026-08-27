# s-test — background: the vitest environment

Read this before planning or writing any spec. It explains **how tests run** in this repo, which is non-obvious and easy to get wrong.

## Where things live

| Concern            | Path                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| Test root / config | `internals/test/` (`vitest.config.ts`, `package.json`)                   |
| Code under test    | `packages/{reactivity,runtime-core,runtime-dom,shared,soppy-vue}/src/**` |
| Test specs         | `internals/test/{reactivity,runtime,e2e}/**/*.spec.ts`                   |
| Alias helper       | `internals/utils/alias.ts` (`@soppy-vue/test-utils`)                     |

Specs and source are **not** co-located — specs live under `internals/test`, source under `packages/*/src`. This is why coverage needs explicit `include`/`exclude` (see below).

## Projects (multi-project setup)

`test.projects` partitions specs into four slices by directory + environment:

| Project | `include` glob | Environment | Purpose |
| --- | --- | --- | --- |
| `unit` | `internals/test/reactivity/**/*.spec.ts` | node | reactivity (no DOM) |
| `unit-jsdom` | `internals/test/runtime/**/*.spec.ts` | jsdom | runtime-core + runtime-dom |
| `e2e-jsdom` | `internals/test/e2e/**/*.spec.ts` | jsdom | full render pipeline |
| `e2e-browser` | `internals/test/e2e/**/*.spec.ts` | Playwright chromium | full render pipeline (real browser) |

`globals: true` — `describe`/`it`/`expect`/`vi` are available without import (types come from `vitest/globals` in `tsconfig.dev.json`).

## Scripts

Run from anywhere with the pnpm filter; the package is `@soppy-vue/test`.

| Script          | Command                                       | Notes                   |
| --------------- | --------------------------------------------- | ----------------------- |
| `test`          | `pnpm --filter @soppy-vue/test test`          | `vitest run --mode dev` |
| `test:watch`    | `pnpm --filter @soppy-vue/test test:watch`    | `vitest --mode dev`     |
| `test:coverage` | `pnpm --filter @soppy-vue/test test:coverage` | adds `--coverage`       |

Filter a single file: `pnpm --filter @soppy-vue/test test -- reactivity/ref` (append args after `--`).

### Why `--mode dev` matters

`mode === "dev"` flips two things in `vitest.config.ts`:

1. `define.__DEV__` → `true`.
2. `resolve.alias = buildAlias(true)` → maps each package name to `packages/*/src`.

**Both** are required: `__DEV__` gates dev-only paths (debugger hooks), and the source alias is the _only_ way imports resolve, because there is **no built `dist`**. Do not run plain `vitest run` without `--mode dev`.

## Imports

Use package aliases, never relative `../../packages/...` paths.

| Intent | Import |
| --- | --- |
| Public reactivity API | `import { ref, reactive, effect, computed } from "@soppy-vue/reactivity"` |
| Public runtime API | `import { render, createVNode, Fragment } from "soppy-vue"` (or `@soppy-vue/runtime-dom`) |
| Internal (non-barrel) module | subpath, e.g. `import { lis } from "@soppy-vue/runtime-core/lis"` |
| Test helper | `import { buildAlias } from "@soppy-vue/test-utils"` |

## Reaching internal (non-exported) methods

There is **no literal `__private__` directory**. An "internal" method is a plain module export that the package barrel (`src/index.ts`) chooses **not** to re-export.

It is reached via **subpath import** — `@soppy-vue/runtime-core/lis` resolves to `packages/runtime-core/src/lis.ts`. Two mechanisms make this work:

- **Vite alias prefix match**: `buildAlias(true)` maps `@soppy-vue/runtime-core` → `packages/runtime-core/src`, and Vite's `find` matches by string prefix, so the `/lis` subpath carries through.
- **TypeScript**: `tsconfig.dev.json` `paths` maps `"@soppy-vue/runtime-core/*": ["./packages/runtime-core/src/*"]`.

For a **dynamic** import of an internal module (to defeat static analysis when a spec is only meaningful in dev mode), use:

```ts
const { lis } = await import(/* @vite-ignore */ "@soppy-vue/runtime-core/lis")
```

`@vite-ignore` stops Vite from trying to resolve the subpath at build time. The resolved module is still correct at runtime because of the alias.

## `__DEV__` gating in specs

`__DEV__` is `true` under `test`/`test:watch`/`test:coverage` (all `--mode dev`). Use it to make a spec (or a whole `describe`) run only in dev:

```ts
describe.runIf(__DEV__)("lis (dev-only internal)", () => {
  it("...", async () => {
    const { lis } = await import(/* @vite-ignore */ "@soppy-vue/runtime-core/lis")
    // ...
  })
})
```

## Coverage

- `provider: "v8"` (dependency `@vitest/coverage-v8`).
- `coverage.include: ["packages/*/src/**/*.ts"]` — targets **source**, not specs.
- `coverage.exclude` drops pure `index.ts` re-export barrels, `global.d.ts`, and spec files (otherwise coverage numbers are skewed by untestable barrel lines).

Run `pnpm --filter @soppy-vue/test test:coverage` to produce the report.

## Gotchas when writing assertions

- **Flag prefix is `__sv_`**, not `__v_` (`ReactiveFlags`, `RuntimeFlags`).
- **Not implemented** (do not test): `readonly`/`shallowReadonly`/`isReadonly`, `markRaw`, `unref`, `customRef`, `toValue`, `effectScope`/`getCurrentScope`/ `onScopeDispose`, Map/Set/collection reactivity, `h()`, `createApp`, `defineComponent`, `Static`, `Suspense`, `toDisplayString`.
- `isProxy(x)` === `isReactive(x)` (no readonly branch).
- `watch`/`watchEffect` (runtime-core `apiWatch`) wrap reactivity `baseWatch`.
- `onRenderTracked`/`onRenderTriggered` and reactivity `onTrack`/`onTrigger` only fire when `__DEV__` is true.
