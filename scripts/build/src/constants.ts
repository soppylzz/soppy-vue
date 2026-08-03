import { existsSync } from "node:fs"
import { resolve } from "node:path"

import type { ModuleFormat } from "rolldown"

function findWorkspaceRoot(): string {
  if (process.env.BUILD_SCRIPT_ROOT) return process.env.BUILD_SCRIPT_ROOT

  const cwd = process.cwd()
  let dir = cwd
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir
    const parent = resolve(dir, "..")
    if (parent === dir) break
    dir = parent
  }
  return cwd
}

const projRoot: string = findWorkspaceRoot()
const pkgRoot = resolve(projRoot, "packages")

const DEFAULT_FORMATS: ModuleFormat[] = ["esm"]

const OUTPUT_DIR = "dist"
const TSCONFIG_LIB = "tsconfig.lib.json"
const EXTENSION_MAP: Partial<Record<ModuleFormat, string>> = {
  cjs: ".cjs",
  esm: ".mjs",
  iife: ".js",
}

export { projRoot, pkgRoot, DEFAULT_FORMATS, OUTPUT_DIR, EXTENSION_MAP, TSCONFIG_LIB }
