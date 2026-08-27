import { defineConfig } from "vite"
import { buildAlias } from "@soppy-vue/test-utils"

export default defineConfig(() => {
  return {
    define: {
      __DEV__: true,
    },
    resolve: {
      // note: always enable alias
      alias: buildAlias(false),
    },
    server: {
      port: 4321,
      open: true,
    },
  }
})
