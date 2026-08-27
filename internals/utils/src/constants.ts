import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const projRoot = resolve(__dirname, "..", "..", "..")
const packagesRoot = resolve(projRoot, "packages")
const internalRoot = resolve(projRoot, "internals")

const setupFile = resolve(internalRoot, "utils", "src", "setup.ts")

export { projRoot, packagesRoot, internalRoot, setupFile }
