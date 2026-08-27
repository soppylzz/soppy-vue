import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { internalRoot, packagesRoot } from "./constants"
import type { Alias } from "vite"

function readPackageName(pkgDir: string): string | undefined {
  const pkgPath = join(pkgDir, "package.json")
  if (!existsSync(pkgPath)) return undefined

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { name?: string; private?: boolean }
    return !pkg.private ? pkg.name : undefined
  } catch {
    return undefined
  }
}

function buildAlias() {
  const aliases: Alias[] = []

  if (existsSync(packagesRoot)) {
    const dirs = readdirSync(packagesRoot, { withFileTypes: true }).filter((d) => d.isDirectory())

    for (const dir of dirs) {
      const importName = readPackageName(join(packagesRoot, dir.name))
      if (importName) {
        aliases.push({ find: importName, replacement: join(packagesRoot, dir.name, "src") })
      }
    }
  }

  return aliases
}

export { buildAlias }
