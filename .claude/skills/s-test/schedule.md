# s-test — schedule: how to plan specs (the `*.temp.md` checklist)

This document governs the **planning** phase. Its output is a `*.temp.md` checklist that the user reviews and approves. Writing the actual spec is a separate phase (`approve.md`) and must NOT happen here.

## Goal of this phase

For a given spec target (e.g. `internals/test/reactivity/ref.spec.ts`), produce a reviewed checklist that fully specifies **what** will be tested — before any test code exists. The user may batch several checklists before approving, so make each self-contained.

## Procedure

1. **Locate the spec target** — the empty `*.spec.ts` under `internals/test/`. Read `background.md` if the environment is unfamiliar.
2. **Read the implementation** — every source module the spec will exercise. This is mandatory: soppy-vue is a _simplified_ Vue 3.4, and its behavior diverges from upstream. Note the exact exports, signatures, and deliberate omissions.
3. **Draft the checklist** and write it to `<spec-name>.temp.md` in the **same directory** as the spec. For `internals/test/runtime/lis.spec.ts`, the checklist is `internals/test/runtime/lis.temp.md`.
4. **Present a summary** in chat (the API, its files, and the test areas) and ask the user to review the checklist. Do **not** write the spec.

## `*.temp.md` format

Use this exact structure. Keep it in English (repo convention).

````markdown
# <spec file name> — test checklist

> status: draft | approved spec: `internals/test/<group>/<name>.spec.ts`

## Target API

- **Modules under test** (package + file path + what it does, one line each).
- **Public exports** exercised: `<list>`.
- **Internal exports** reached via subpath: `<list>` (or "none").
- **Deliberately NOT implemented / not tested**: `<list>`.

## Import style

```ts
// the exact imports the spec will use
```

## Test cases

For each `describe` block: its focus, then a `- [ ]` item per `it` case, each specifying **input → expected output/behavior** (including the `__DEV__`/`runIf` gate when relevant).

### `describe("<block name>")`

- [ ] `<it title>` — `<input>` → `<expected>`.
- [ ] ...

## Edge cases & regression notes

- Any boundary conditions, scheduling/timing notes, or known divergences from Vue that the assertions must respect.
````

## Checklist quality bar

- Each `- [ ]` is a **specific, assertable** behavior (concrete input → concrete expectation), not a vague "test the ref API".
- `__DEV__`-gated cases (debugger hooks, internal dynamic imports) are marked explicitly with the `describe.runIf(__DEV__)` note.
- The `Target API` section names the source files so a future reviewer can re-open them, and lists what is _deliberately not tested_ so nobody wastes effort porting Vue's tests for absent features.
- Import paths are exactly what the spec will use (package alias / subpath).

## Interaction with the user

End this phase by summarizing (a) the target API and its files, (b) the proposed test areas, and (c) the checklist path — then ask the user to review/edit it. The user may approve immediately, edit the `.temp.md` themselves, or defer writing until several checklists are done.
