import type {
  ModuleFormat,
  BuildOptions,
  OutputOptions,
  ExternalOptionFunction,
  WatchOptions,
} from "rolldown"

type BuildMode = "prod" | "dev"

interface BuildArgs {
  mode: BuildMode
  dryRun?: boolean
}

interface PackageInfo {
  path: string
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pkg: Record<string, any>
}

interface PackageBuildOptions extends Pick<OutputOptions, "dir"> {
  /* skip building this package explicitly */
  __skipBuild?: boolean

  /* whether to emit dts for this package */
  dts?: boolean

  /* input & output options from rolldown */
  external?: Exclude<BuildOptions["external"], ExternalOptionFunction>
  formats?: ModuleFormat | ModuleFormat[]
  /* iife mounte name */
  name?: string
}

interface BuildContext {
  name: string
  mode: BuildMode

  /* related to dts-file generation */
  dir: string
  dts: boolean

  /**
   * one build configuration for each format
   * - BuildOptions in production mode
   * - WatchOptions in development mode
   */
  options: (WatchOptions | BuildOptions)[]
}

export type { BuildMode, BuildArgs, PackageInfo, PackageBuildOptions, BuildContext }
