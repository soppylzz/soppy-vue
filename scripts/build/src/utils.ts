import { execSync } from "node:child_process"
import { existsSync, cpSync } from "node:fs"
import { join, basename, dirname, relative } from "node:path"
import readline from "node:readline"
import { isArray } from "lodash-unified"
import { consola } from "consola"
import chalk from "chalk"
import { projRoot, TSCONFIG_LIB } from "./constants"

import type { BuildContext } from "./types"

function createBuildLogger(scope?: string): typeof consola {
  if (scope) return consola.withTag(scope)
  return consola.withTag("build")
}

const globalLog = createBuildLogger("build")

function ensureArray<T>(value: T | T[]): T[] {
  return isArray(value) ? value : [value]
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function generateDts(ctxs: Set<BuildContext>, increment: boolean = false): void {
  const log = createBuildLogger("dts")
  const verbose = !increment

  // 1. tsc -b at workspace root — incremental, project references
  void (verbose && log.info(`generating type declarations via ${chalk.cyan("tsc --build")}...`))

  try {
    execSync(`npx tsc --build ${TSCONFIG_LIB}`, {
      cwd: projRoot,
      stdio: "inherit",
      encoding: "utf-8",
    })

    let generated = 0
    for (const ctx of ctxs) {
      if (!ctx.dts) continue

      // tsconfig.lib.json rootDir=packages → tsc emits <projRoot>/dist/<pkgDirName>/src/**
      // we flatten "src/" away when copying to <pkgDir>/dist/types/**
      const pkgDir = dirname(ctx.dir)
      const srcDir = join(projRoot, "dist", basename(pkgDir), "src")
      const dest = join(ctx.dir, "types")

      // 2. copy emitted .d.ts from <projRoot>/dist/<pkgName>/ → <pkgDir>/dist/types
      if (!existsSync(srcDir)) {
        log.warn(
          `no dts output for "${chalk.cyan(ctx.name)}" at ${chalk.dim(relative(projRoot, srcDir))}`
        )
        continue
      }
      cpSync(srcDir, dest, { recursive: true })
      generated++
    }

    if (generated === 0) throw new Error("no dts output generated")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.fail(`generating failed: ${chalk.dim(message)}\n`)
    return
  }

  void (verbose && log.success("type declarations generated\n"))
}

function setupWatchTerminal(onExit: () => void) {
  if (!process.stdin.isTTY) return

  readline.emitKeypressEvents(process.stdin)

  process.stdin.setRawMode(true)
  process.stdin.resume()

  const handler = (_str: string, key: readline.Key) => {
    if (key.ctrl && key.name === "c") onExit()
    if (key.name === "q") onExit()
  }

  process.stdin.on("keypress", handler)
  return () => {
    process.stdin.removeListener("keypress", handler)

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()
  }
}

export {
  createBuildLogger,
  ensureArray,
  formatDuration,
  generateDts,
  setupWatchTerminal,
  globalLog,
}
