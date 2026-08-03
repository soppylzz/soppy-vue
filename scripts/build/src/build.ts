import { performance } from "node:perf_hooks"
import { relative } from "node:path"
import {
  createBuildLogger,
  formatDuration,
  generateDts,
  globalLog,
  setupWatchTerminal,
} from "./utils"
import { projRoot } from "./constants"
import { build, watch } from "rolldown"
import chalk from "chalk"

import type { BuildOptions, RolldownOutput, RolldownWatcher, WatchOptions } from "rolldown"
import type { BuildContext } from "./types"

async function buildPackage(ctx: BuildContext) {
  const { name, options } = ctx

  let failures = 0

  for (const opts of options) {
    const format = (opts as BuildOptions).output?.format || "unknown"
    const id = `${name}/${format}`

    const log = createBuildLogger(id)
    log.info(`building ${chalk.cyan(id)}...`)

    const startedAt = performance.now()
    try {
      const result: RolldownOutput = await build(opts as BuildOptions)

      result.output
        .filter((chunk) => !chunk.fileName.endsWith(".map"))
        .forEach((chunk) => {
          console.log(chalk.dim(`  ${chunk.fileName}`))
        })
    } catch (err) {
      log.error(err)
      failures++
      continue
    }

    const elapsed = performance.now() - startedAt
    log.success(`built in ${chalk.green(formatDuration(elapsed))}\n`)
  }

  if (failures > 0) throw new Error(`${failures} formats failed`)
}

async function buildAll(ctxs: BuildContext[]) {
  const dtsCtxs = new Set(ctxs.filter((c) => c.dts))
  let allFailures = 0

  for (const ctx of ctxs) {
    try {
      await buildPackage(ctx)
    } catch {
      allFailures++
    }
  }

  if (allFailures > 0) {
    globalLog.fail(`${chalk.yellow(allFailures)} packages failed to build`)
    process.exitCode = 1
    return
  }

  globalLog.success(`all ${chalk.green(ctxs.length)} packages built successfully\n`)

  if (dtsCtxs.size > 0) {
    generateDts(dtsCtxs)
  }
}

async function watchAll(ctxs: BuildContext[]) {
  const dtsCtxs = new Set(ctxs.filter((c) => c.dts))

  // flatten all packages' WatchOptions into a single array
  const allOptions: WatchOptions[] = ctxs.flatMap((ctx) => ctx.options as WatchOptions[])

  if (allOptions.length === 0) {
    globalLog.fail("no packages to watch")
    return
  }

  let closed = false
  let isInitialized = false

  const globalWatcher: RolldownWatcher = watch(allOptions)

  const shutdown = async () => {
    if (closed) return
    closed = true

    cleanupTerminal?.()
    await globalWatcher.close()
    process.exit(0)
  }
  const cleanupTerminal = setupWatchTerminal(shutdown)

  globalWatcher.on("event", (event) => {
    switch (event.code) {
      case "BUNDLE_END": {
        if (!isInitialized) {
          const formattedOutputs = event.output
            .map((f) => chalk.dim(`  ${relative(projRoot, f)}`))
            .join("\n")

          globalLog.success(
            `rebuilt ${chalk.green(ctxs.length)} package(s) in ${chalk.green(formatDuration(event.duration))}`
          )
          console.log(formattedOutputs + "\n")
        }

        event.result.close()
        break
      }
      case "END":
        if (dtsCtxs.size > 0) {
          generateDts(dtsCtxs, isInitialized)
          isInitialized = true
        }
        break
      case "ERROR":
        globalLog.fail(`build error: ${event.error.message}`)
        break
    }
  })

  globalWatcher.on("change", (id, change) => {
    console.log(chalk.dim(`  ${change.event} → ${relative(projRoot, id)}`))
  })

  console.log(`  - watching ${chalk.yellow(ctxs.length)} packages`)
  console.log(`  - ${chalk.yellow("Ctrl+C")} or ${chalk.yellow("Q")} to stop\n`)

  process.once("SIGINT", shutdown)
  process.once("SIGTERM", shutdown)
}

export { buildAll, watchAll }
