import { defineConfig } from "eslint/config"
import globals from "globals"
import js from "@eslint/js"
import markdown from "@eslint/markdown"
import tseslint from "typescript-eslint"
import importPlugin from "eslint-plugin-import"
import { default as jsonc } from "eslint-plugin-jsonc"

// light: defineConfig use jsDoc to validate configs
export default defineConfig([
  /* =============== ignores =============== */
  {
    // must include "**/" wildcard to ignore `dist`, `node_modules` at all levels
    ignores: ["**/dist", "**/node_modules", "pnpm-lock.yaml", "**/.vitepress/cache"],
  },

  /* =============== extends =============== */
  // json5 parser allows: comments, trailing commas, unquoted keys
  ...jsonc.configs["recommended-with-json5"],
  ...jsonc.configs.prettier,

  js.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,

  /* =============== base config =============== */
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

  /* =============== markdown relatives =============== */
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

  /* =============== json rules =============== */
  {
    files: ["**/*.{json,jsonc,json}"],
    languageOptions: {
      parser: jsonc,
    },
  },

  /* =============== ts rules =============== */
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
      /**
       * special allows below:
       * 1. allow use `Function` directly
       * 2. allow `xxx && yyy`
       * 3. allow `interface XXX extends {}`
       */
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      /**
       * note: in face, we must disable this check, even with
       * well-implemented type annotation, the use of `any` is
       * still unavoidable, same applies to `tsconfig`.
       */
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["off", { argsIgnorePattern: "^_" }],
    },
  },

  /* =============== ts spec rules =============== */
  {
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-this-alias": "off",
    },
  },
])
