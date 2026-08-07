import { readdirSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve, join, basename } from "node:path"
import { DEFAULT_FORMATS, EXTENSION_MAP, OUTPUT_DIR, pkgRoot } from "./constants"
import { ensureArray, globalLog } from "./utils"
import glob from "fast-glob"

import type {
  InputOptions,
  OutputOptions,
  BuildOptions,
  WatchOptions,
  ModuleFormat,
} from "rolldown"
import type { BuildContext, PackageBuildOptions, PackageInfo, BuildArgs } from "./types"

function resolveBuildContext(pkgInfo: PackageInfo, buildArgs: BuildArgs): BuildContext {
  const { path, pkg } = pkgInfo
  const { mode, dryRun = false } = buildArgs

  const raw: PackageBuildOptions = pkg.buildOptions || {}

  const dir = resolve(path, OUTPUT_DIR)
  const name = pkg.name || basename(path)
  const formats = ensureArray(raw?.formats ?? DEFAULT_FORMATS)

  const isProd = mode === "prod"
  const isSkip = raw.__skipBuild ?? pkg.private === true

  // explicit user setting wins; otherwise emit dts when any format is cjs/esm
  const needsDts = raw.dts ?? formats.some((f) => f === "cjs" || f === "esm")

  function generateExternal(iife: boolean) {
    const getDeps = (deps?: Record<string, unknown>) => Object.keys(deps ?? {})

    return [
      ...ensureArray(raw?.external ?? []),
      ...getDeps(iife ? {} : pkg.dependencies),
      ...getDeps(pkg.peerDependencies),
    ]
  }

  function resolveInputOptions(format: ModuleFormat): InputOptions | null {
    const isIIFE = format === "iife"

    // prod: glob entry files; dev: single entry point
    const input = !isProd
      ? glob.sync(["**/*.{js,ts}"], {
          cwd: path,
          absolute: true,
          onlyFiles: true,
          ignore: ["dist/**", "node_modules/**"],
        })
      : [resolve(path, "src", "index.ts")].find((p) => existsSync(p))

    if (!input || input.length === 0) {
      globalLog.warn("unable to find input files")
      return null
    }

    return {
      input,
      external: generateExternal(isIIFE),
    }
  }

  function resolveOutputOptions(format: ModuleFormat): OutputOptions | null {
    const ext = EXTENSION_MAP[format]
    if (!ext) {
      globalLog.warn("unexpected build format")
      return null
    }

    const isIIFE = format === "iife"
    // preserve module structure only in dev for non-iife (esm/cjs)
    const preserveModules = !isProd && !isIIFE

    return {
      dir,
      format,
      name: raw.name,
      sourcemap: !isProd,
      entryFileNames: `[name]${ext}`,
      preserveModules,
      preserveModulesRoot: preserveModules ? resolve(path, "src") : undefined,
      minify: isProd ? { compress: { dropDebugger: true } } : false,
    }
  }

  if (isSkip) {
    return { name, dir, dts: false, mode, options: [] }
  }

  const pairs: { input: InputOptions; output: OutputOptions }[] = []
  for (const fmt of formats) {
    const input = resolveInputOptions(fmt)
    const output = resolveOutputOptions(fmt)
    if (input && output) {
      pairs.push({ input, output })
    }
  }

  if (pairs.length === 0) {
    globalLog.warn(`no valid build entries for "${name}"`)
    return { name, dir, dts: false, mode, options: [] }
  }

  // one entry per format → BuildOptions (prod) or WatchOptions (dev)
  const options = pairs.map(({ input, output }) => {
    if (isProd) {
      return { ...input, output, write: !dryRun } satisfies BuildOptions
    }
    return { ...input, output } satisfies WatchOptions
  })

  return { name, dir, dts: needsDts, mode, options }
}

function resolveAllPackages(args: BuildArgs): BuildContext[] {
  const localRequire = createRequire(import.meta.url)

  if (!existsSync(pkgRoot)) {
    globalLog.warn(`no ${pkgRoot}/ directory found`)
    return []
  }

  const dirs = readdirSync(pkgRoot, { withFileTypes: true }).filter((d) => d.isDirectory())

  const packages: PackageInfo[] = []

  for (const dir of dirs) {
    const pkgPath = join(pkgRoot, dir.name, "package.json")
    if (!existsSync(pkgPath)) continue

    try {
      const pkg = localRequire(pkgPath)
      packages.push({
        path: join(pkgRoot, dir.name),
        name: pkg.name || dir.name,
        pkg,
      })
    } catch {
      globalLog.warn(`failed to require ${pkgPath}, skipping`)
    }
  }

  return packages.map((p) => resolveBuildContext(p, args)).filter((ctx) => ctx.options.length > 0)
}

export { resolveAllPackages }
