import { defineConfig } from "vite"
import { buildAlias } from "@soppy-vue/test-utils"

export default defineConfig(({ mode }) => {
  const isDev = mode === "dev"

  return {
    define: {
      __DEV__: isDev,
    },
    resolve: {
      alias: buildAlias(),
    },
    server: {
      port: 4321,
      open: true,
    },
  }
})
