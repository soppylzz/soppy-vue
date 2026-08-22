import { defineConfig } from "eslint/config"
import globals from "globals"
import js from "@eslint/js"
import markdown from "@eslint/markdown"
import tseslint from "typescript-eslint"
import importPlugin from "eslint-plugin-import"
import { default as jsonc } from "eslint-plugin-jsonc"

export default defineConfig([
  // defineConfig use jsDoc to validate configs
  {
    // must include "**/" wildcard to ignore `dist`, `node_modules` at all levels
    ignores: ["**/dist", "**/node_modules", "pnpm-lock.yaml"],
  },

  // json5 parser allows: comments, trailing commas, unquoted keys
  ...jsonc.configs["recommended-with-json5"],
  ...jsonc.configs.prettier,

  js.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,

  {
    rules: {
      "import/no-unresolved": "off",
    },
  },

  {
    files: ["**/*.{js,ts,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2026,
      },
    },
  },
  {
    files: ["**/*.{json,jsonc,json}"],
    languageOptions: {
      parser: jsonc,
    },
  },

  // markdown relatives
  {
    name: "markdown/custom",
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    language: "markdown/gfm",
    languageOptions: {
      frontmatter: "yaml",
      math: true,
    },
  },
  {
    name: "markdown/custom/processor",
    files: ["**/*.md"],
    plugins: {
      markdown,
    },
    processor: "markdown/markdown",
  },
  {
    name: "markdown/custom/code",
    files: ["**/*.md/*.{js,ts,mjs,cjs}"],
    rules: {
      "no-empty": "off",
      "no-undef": "off",
      "no-console": "off",
      "no-debugger": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },

  // ts relatives
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          disallowTypeAnnotations: true,
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      // allow use `Function` directly
      "@typescript-eslint/no-unsafe-function-type": "off",

      // allow `xxx && yyy`
      "@typescript-eslint/no-unused-expressions": "off",

      // allow `interface XXX extends {}`
      "@typescript-eslint/no-empty-object-type": "off",

      // temporarily disable any-check, for lib quick building
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["off", { argsIgnorePattern: "^_" }],
    },
  },
])
