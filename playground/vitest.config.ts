import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["node/**/*.spec.ts"],
  },
  define: {
    __DEV__: true,
  },
})
