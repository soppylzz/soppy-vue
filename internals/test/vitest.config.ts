import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"
import { buildAlias, projRoot, setupFile } from "@soppy-vue/test-utils"

export default defineConfig(({ mode }) => {
  const isDev = mode === "dev"

  return {
    root: projRoot,
    define: {
      __DEV__: isDev,
    },
    resolve: {
      alias: buildAlias(),
    },
    test: {
      globals: true,
      isolate: true,
      setupFiles: !isDev ? setupFile : undefined,
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json-summary"],
        /**
         * note: test code lives under internals/test while the code under test
         * lives under `packages/*`. coverafe must target the SOURCE, not the specs,
         * so `include` scopes to the packages' src
         */
        include: ["packages/*/src/**/*.ts"],
        exclude: [
          // exclude pure re-export barrels
          "packages/*/src/**/index.ts",
          "packages/global.d.ts",
          "**/*.spec.ts",
          "**/*.temp.md",
        ],
      },
      projects: [
        /* =============== unit/integration proj =============== */
        {
          extends: true,
          /**
           * light: every project goes through the defineConfig
           * process to ensure that the mode is passed.
           */
          mode: mode,
          test: {
            // generic js/ts logic (no DOM)
            name: "unit",
            include: ["internals/test/reactivity/**/*.spec.ts"],
          },
        },
        {
          extends: true,
          mode: mode,
          test: {
            // DOM-related code
            name: "unit-jsdom",
            environment: "jsdom",
            // its scope is `runtime-core`/`runtime-dom`
            include: ["internals/test/runtime/**/*.spec.ts"],
          },
        },
        /* =============== full render pipeline =============== */
        {
          extends: true,
          mode: mode,
          test: {
            name: "e2e-jsdom",
            environment: "jsdom",
            include: ["internals/test/e2e/**/*.spec.ts"],
            exclude: [],
          },
        },
        {
          extends: true,
          mode: mode,
          test: {
            name: "e2e-browser",
            include: [],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  }
})
