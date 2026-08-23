---
name: s-commit
description: Draft a git commit message in this repo's established Conventional Commits style (type(scope) + `setup include:`/`change include:` body). Reads the staged diff, outputs a ready-to-paste message, and never runs `git commit`.
---

# /s-commit — draft a commit in this repo's style

Draft (but do **not** run) a git commit message that matches the format used throughout this repository's history. You produce the message; the user pastes it or runs `git commit` themselves.

## Steps

1. Inspect what changed:
   - `git diff --cached --stat` and `git diff --cached`
   - If nothing is staged, fall back to `git diff` and `git status`, and note in your output that these changes are unstaged.
2. Classify each changed path into `type` and `scope`:
   - **scope** = package name, derived from `packages/<name>/...`: `reactivity`, `shared`, `soppy-vue`. Treat `runtime-core` **and** `runtime-dom` together as `runtime`. Omit scope when the change spans unrelated packages or is repo-level (configs, CI, scripts, `.claude/`).
   - **type**:
     - `feat` — new API/module/feature or a renderer capability
     - `fix` — a bug fix or correction
     - `chore` — build/tooling/config/CI/release housekeeping (or dependency updates)
     - `refactor` / `perf` / `docs` / `test` / `style` / `build` / `ci` / `revert` — when clearly appropriate.
3. Write the message per the format below.
4. **Output only**: print the full message in a fenced code block. Do **not** stage, commit, push, or modify any file.

## Format

```
<type>(<scope>): <imperative subject, lowercase, no trailing period>

setup include:
- <module>: <what was introduced>

change include:
- <module>: <what changed>

[optional trailing note, e.g. "further optimizations will follow"]
```

Rules (kept aligned with `commitlint.config.mjs`):

- **Header** `type(scope): subject`; subject is imperative, starts lowercase, ends with no `.`. Keep it under ~72 chars. Use backticks around code identifiers (e.g. `` implement vue-like `provide`/`inject` ``).
- **`setup include:`** — only for net-new implementation/bootstrap work: new modules, new APIs, or new packages. Bullet = `<module>: <introduced>`.
- **`change include:`** — modifications, refinements, and supporting edits that accompany the feature. Bullet = `<module>: <changed>`.
- Omit a section entirely when nothing fits it — many commits have only `change include:`.
- Prefer concrete module names over generic "misc"; group a handful of trivial tweaks under one `misc:` bullet rather than one bullet per file.
- Add a short trailing paragraph when the commit has a known caveat or planned follow-up (see the `watch` commit in history).

## Examples

```
chore: consolidate public API exports

change include:
- reactivity: internal exports via `export *`
- runtime-core: re-export public api via explicit value/type exports instead of `export *`
- misc: remove current skills, a more efficient version coming soon; adjust claude setting.json
```

## Output format

After drafting, always end with the message in a single fenced block so it can be copied directly:

```
<message>
```

Never run `git commit`, `git add`, or `git push`.
