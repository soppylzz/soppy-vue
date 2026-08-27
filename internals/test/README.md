# @soppy-vue/test

Vitest specs for soppy-vue (a simplified Vue 3.4). Specs live here under `internals/test`; the code under test lives in `packages/*/src`.

## Man-made test infrastructure

The test infra is set up manually, modeled on Vue 3.5's `vitest.config.ts`.

- **Multi-project**: splits specs by directory + environment — `unit` (reactivity, node), `unit-jsdom` (runtime-core/runtime-dom), `e2e-jsdom` / `e2e-browser` (full render pipeline).
- **Aliases** resolve package names to `packages/*/src` (via `@soppy-vue/test-utils`'s `buildAlias`), so specs import source, never a built `dist`.

## Agent-driven test case

Specs are authored through the `/s-test` skill using a two-phase, checklist-gated flow. Every spec has a sibling `<name>.temp.md` checklist (git-ignored).

1. **Propose** — ask the agent to plan a spec: `"/s-test plan tests for <module>"`. The agent reads the source, writes a `<name>.temp.md` checklist (target API, imports, one `- [ ]` per `it` case), and summarizes it for review.
2. **Approve** — review/edit the checklist, then tell the agent it's approved. The spec is not written until this happens.
3. **Complete** — the agent consumes the checklist, writes the `.spec.ts`, and runs it until green:
   ```bash
   pnpm --filter @soppy-vue/test test -- <group>/<name>
   ```
4. **Modify** — report any `it` that errors (reason, divergence from Vue 3.4, and whether to fix soppy-vue or the spec). The agent distinguishes real soppy-vue bugs (fix the source) from wrong assumptions (fix the spec) instead of silently rewriting expectations.

## Misc

- The implementation is a **simplified** Vue 3.4; read the source module before asserting — do not port Vue's own test suite blindly.
- `__DEV__` gated blocks use `describe.runIf(__DEV__)`; internal modules are imported dynamically with `/* @vite-ignore */`.
