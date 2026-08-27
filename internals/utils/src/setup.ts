import { join } from "node:path"
import { existsSync, readdirSync } from "node:fs"
import { packagesRoot } from "./constants"

/**
 * note: current import resolution scenario:
 * - DEV: use alias to resolve TS file entry
 * - PROD: resolves `@soppy-vue/*` follow:
 *   `node_modules` -> each package's `dist` (via symlinks)
 * - WATCH: considered as a variant of DEV
 *
 * prod bundles are built OUTSIDE the test runner: `pnpm test:prod` runs
 * `build:prod` before `vitest`. this guard only *verifies* they exist, so a
 * stale `dist` is never silently reused as the source of truth — the caller
 * is responsible for (re)building it.
 */
function ensureProdBundle() {
  if (!existsSync(packagesRoot)) return

  const missing = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !existsSync(join(packagesRoot, d.name, "dist", "index.mjs")))
    .map((d) => d.name)

  if (missing.length === 0) return

  throw new Error(
    `missing prod bundle for: ${missing.join(", ")}. ` + `run \`pnpm run build:prod\` first.`
  )
}

// ensure each packages' `dist` existed
!__DEV__ && ensureProdBundle()
