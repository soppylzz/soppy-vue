# s-test — approve: how to write a spec from its checklist

This document governs the **writing** phase. It consumes an approved `*.temp.md` checklist and produces the `.spec.ts`. It must NOT be used before the user has approved the checklist.

## Prerequisites

- A sibling `*.temp.md` with `status: approved` (or explicit user go-ahead).
- The source modules read during planning are still accurate — re-open them if the checklist is stale or the code changed.

## Procedure

1. **Confirm the checklist status.** If `status` is still `draft`, stop and ask — writing against an unapproved checklist violates the workflow.
2. **Flip status to `approved`** in the `.temp.md` (if not already) and update the `status` line.
3. **Write the spec** at the `.spec.ts` path named in the checklist, using exactly the import style listed there. Do not deviate to add untested cases silently.
4. **Run it** and iterate until green. Command: `pnpm --filter @soppy-vue/test test -- <group>/<name>` (e.g. `-- reactivity/ref`).
5. **Report** the result: pass/fail counts, and any checklist item you could not satisfy (with the reason) rather than silently skipping it.

## Style & conventions

Match the surrounding repo style (no semicolons, single quotes, trailing commas):

```ts
import { ref, effect } from "@soppy-vue/reactivity"

describe("ref", () => {
  it("is a getter/setter over `value`", () => {
    const r = ref(1)
    expect(r.value).toBe(1)
  })
})
```

- Use `describe`/`it`/`expect` as globals (no import — `globals: true`).
- `__DEV__`-gated blocks: `describe.runIf(__DEV__)(...)`.
- Internal dynamic imports: `await import(/* @vite-ignore */ "@soppy-vue/…/module")`.
- Assertions target observable behavior — return values, side effects, scheduling order via `await nextTick()` / `vi.useFakeTimers()` where needed.

## Divergence guard

If a test from the checklist cannot be expressed because the implementation diverges from what was assumed, do **not** silently change the expectation to match reality in a way that hides a bug. Surface the discrepancy to the user and update the checklist first.

## Definitions of done

- [ ] Spec exists at the checklist's `spec:` path.
- [ ] Every `- [ ]` in the checklist maps to an `it` (or is explicitly deferred with a reason).
- [ ] The spec passes under `pnpm --filter @soppy-vue/test test`.
- [ ] No new unapproved cases were added beyond the checklist.
