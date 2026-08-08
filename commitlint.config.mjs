const preset = {
  types: [
    { type: "feat", section: "✨ Features" },
    { type: "fix", section: "🐛 Bug Fixes" },
    { type: "docs", section: "📚 Documentation", hidden: false },
    { type: "style", hidden: true },
    { type: "refactor", hidden: true },
    { type: "perf", hidden: true },
    { type: "test", hidden: true },
    { type: "build", hidden: true },
    { type: "ci", hidden: true },
    { type: "chore", hidden: true },
    { type: "revert", hidden: true },
  ],
}

export default {
  extends: ["@commitlint/config-conventional"],
  parserPreset: preset,
  rules: {
    "type-enum": [2, "always", preset.types.map((item) => item.type)],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [0, "always", 120],
  },
  ignores: [(msg) => msg.startsWith("WIP") || msg.startsWith("Merge")],
  defaultIgnores: true,
}
