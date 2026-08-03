import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  external: ["rolldown"],
  format: ["esm"],
  clean: true,
  dts: false,
})
