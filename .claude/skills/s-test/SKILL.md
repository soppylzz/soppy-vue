---
name: s-test
description: Plan and write vitest specs for soppy-vue. Use for authoring, planning (checklist `*.temp.md`), or reviewing test scripts. Entry point routes to background/schedule/approve docs by phase.
---

# /s-test — plan and write soppy-vue test specs

Author vitest specs for this repo using a two-phase, checklist-gated flow:

1. **Plan** — read the source, write a checklist to a `*.temp.md` file, discuss it with the user, then stop (do not write the spec yet). See `schedule.md`.
2. **Write** — after the checklist is approved, consume it to write the spec. See `approve.md`.

## Which phase am I in?

- The user asks to **plan** a spec, produce a checklist, or "what should we test for `X`" → follow `schedule.md`.
- The user says a checklist is **approved / good / go ahead**, or asks to **write / implement / fill in** the spec → follow `approve.md`.

## Before anything else

If you are unfamiliar with the vitest environment here (projects, alias, `__DEV__`, coverage, how internal modules are reached), read `background.md` first.

## Routing table

| User intent                                      | Read            |
| ------------------------------------------------ | --------------- |
| "How do the tests run / what environment?"       | `background.md` |
| "Plan tests / write a checklist for `<file>`"    | `schedule.md`   |
| "Write the spec for `<file>` from its checklist" | `approve.md`    |

## Hard rules (apply to every phase)

- Every spec file has a sibling `<name>.temp.md` checklist. Checklists are git-ignored (`*.temp.md`). A spec must NOT be written without a reviewed checklist.
- The implementation under test is a **simplified Vue 3.4**, not Vue itself. Always read the source module before writing assertions — do not port Vue's own test suite blindly.
- Use the package alias imports (`@soppy-vue/reactivity`, `soppy-vue`, and subpaths like `@soppy-vue/runtime-core/lis`) — never relative `../../packages/...` paths.
- Run specs via `pnpm --filter @soppy-vue/test test` (dev mode, source aliased).
