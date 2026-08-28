---
title: "Release"
---

# Release

Monorepo 项目根据最终代码的发布方式，通常可以分为两种模式：

- **单包发布**：Monorepo 里可能有多个目录（如 `apps/`、`packages/`），但最终对外只发布**一个** Npm 包。
- **多包发布**：Monorepo 中每个子包都有自己的 `package.json`，**各自拥有独立的版本号**，并且可以独立发布。

需要注意，Monorepo 架构 != 多包发布。Monorepo 只是把多个项目存放在一个 Git 仓库管理。相较于 Polyrepo ，其优势主要体现在 **协作**、**复用**、**一致性**、**可维护** 四个层面。

> 错误观点：我们用的是 Monorepo，所以一定是多包发布❌。

### 1. Poly release

这种只有一个产物的项目一般采用 `semantic-release` 来辅助发布，配置参考：

```js
// co-preset for commitlint and semantic-release
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
  repositoryUrl: "",
  branches: ["main", "dev"],
  plugins: [
    // the order in which plugins are configured is very important
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        presetConfig: preset,
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: preset,
      },
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message: "chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
}
```

### 2. Mono release

> 本项目是对 Vue 框架的重新实现，因此选择采用与 Vue 源码相同的多包发布模式；

[TEMP]

## CD

[TEMP]
