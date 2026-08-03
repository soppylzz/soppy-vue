import { defineConfig } from "vite"

export default defineConfig({
  optimizeDeps: {
    exclude: ["soppy-vue"],
  },
  server: {
    port: 4321,
  },
})
