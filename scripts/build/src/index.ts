import mri from "mri"
import { globalLog } from "./utils"

import type { BuildArgs, BuildMode } from "./types"
import { resolveAllPackages } from "./config"
import { buildAll, watchAll } from "./build"
import chalk from "chalk"

const args = mri(process.argv.slice(2), {
  boolean: ["prod", "dev", "dry-run"],
  default: { prod: true },
})

const buildArgs: BuildArgs = {
  mode: (args.dev ? "dev" : "prod") as BuildMode,
  dryRun: args["dry-run"] ?? false,
}

async function main(): Promise<void> {
  const colorMode = (buildArgs.mode === "dev" ? chalk.red.bold : chalk.green.bold)(buildArgs.mode)

  globalLog.info(`starting build in ${colorMode} mode...\n`)

  const packages = resolveAllPackages(buildArgs)

  if (packages.length === 0) {
    globalLog.warn("no packages found to build\n")
    return
  }

  globalLog.info(`building package: ${packages.map((p) => chalk.cyan(p.name)).join(", ")}\n`)

  const buildFn = buildArgs.mode === "prod" ? buildAll : watchAll
  await buildFn(packages)
}

main().catch((err) => {
  globalLog.error(`unexpected error: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
