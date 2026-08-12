## PkgManager

本项目使用 `nvm@0.40.6` + `node@22.23.2` + `pnpm@11.17.0` 搭建开发运行环境，这里就不介绍它们的安装流程，主要讲解一下我的使用心得。

### Nvm

我使用 `nvm` 来管理不同项目使用的 Node 版本。项目使用的 Node 版本可能与当前 `nvm use` 的版本不同，这里简单介绍一下自动切换 Node 的方法：

- `.nvmrc` + shell：在项目根目录创建 `.nvmrc` ，然后在 `~/.zshrc` / `~/.bashrc` 中配置自动启动脚本：

  ```shell
  # Auto use node version in .nvmrc
  if [[ -f ".nvmrc" && -r ".nvmrc" ]]; then
  	nvm use &>/dev/null
  fi
  ```

- 使用 VSCode 第三方插件实现自动切换。

### Pnpm

Vue 源码采用 Monorepo 架构搭建。参考源码，本项目也采用 `pnpm` 来搭建项目开发架构。在使用前我们需要编写 `pnpm-workspace.yaml` 配置本地子包的查询路径，使用 `.npmrc`<sup>`ini`</sup> 来控制 Npm 包的安装策略：

- `shamefully-hoist`：启用后，Pnpm 会将依赖**扁平化安装到项目根目录的 `node_modules/.pnpm` 中**，再通过软链接将依赖暴露到根目录/子包的 `node_modules/xxx-pkg` 中

  > 该模式主要用于兼容那些“硬编码依赖解析路径”的老旧库或工具链。

- `shell-emulator`：启用后，Pnpm 会在内部模拟一个 **跨平台 Shell 环境**，用于 `scripts`、`prepare`、`postinstall` 等生命周期脚本，例如：

  ```json
  { "build": "rimraf dis && rollup -c && echo \" build success \"" }
  ```

- `strict-peer-dependencies`、`engine-strict`：启用后，Pnpm 会在安装包时校验其 `package.json` 的 `engines` / `peerDependencies` 字段，确保满足包所需执行环境。

以下是 Pnpm 在管理 Monorepo 项目的常用命令：

| 命令 | 说明 |
| --- | --- |
| `pnpm i -w [pkg_name]` | 将依赖安装到根目录，所有子包都能 `import` / `require` 到。一般用于安装公用依赖，可以在安装后显示指定子包依赖。 |
| `pnpm i --workspace [pkg_name]` | 将本地子包作为依赖安装，如果不设置 `--workspace` ，Pnpm 只会到 registry 中搜索依赖。 |
| `pnpm i --filter [sub_pkg] [pkg_name]` | 显式指定需要安装的子包。 |

## VScode

这里也贴一下我的 VSCode 配置：

- **全局配置**：

  ```json
  {
    // default settings for all workspaces
    "explorer.confirmDelete": false,
    "workbench.startupEditor": "none",
    "chat.viewSessions.orientation": "stacked",
    "terminal.integrated.fontSize": 13,
    "terminal.integrated.fontFamily": "MesloLGS NF",

    // use iTerm as the default terminal on macOS
    "terminal.integrated.shellIntegration.enabled": true,
    "terminal.external.osxExec": "iTerm.app",

    // make sure snippets have higher priority than quick suggestions
    "editor.tabCompletion": "on",
    "editor.inlineSuggest.enabled": true,
    "editor.acceptSuggestionOnEnter": "off",

    // gitlens.ai settings
    "gitlens.ai.model": "vscode",
    "gitlens.ai.vscode.model": "copilot:gpt-4o-mini",

    // open in external app settings
    "openInExternalApp.openMapper": [
      {
        "extensionName": "md",
        "apps": [
          {
            "title": "Typora",
            "openCommand": "/Applications/Typora.app"
          }
        ]
      }
    ],

    // theme settings
    "workbench.iconTheme": "material-icon-theme",
    "workbench.colorTheme": "GitHub Dark Default",

    // editor settings
    "editor.tabSize": 2,
    "editor.fontSize": 14,
    "editor.fontLigatures": true,
    "editor.minimap.enabled": false,
    "editor.detectIndentation": false,
    "editor.accessibilitySupport": "off",
    "editor.fontFamily": "'Fira Code', 'JetBrains Mono', Consolas, monospace"
  }
  ```

- **项目配置** `.vscode/settings.json`：

  ```json
  {
    // use workspace TypeScript version instead of VSCode built-in
    "js/ts.tsdk.path": "node_modules/typescript/lib",

    // prettier formatter settings
    "editor.formatOnSave": true,
    "editor.formatOnSaveMode": "file",
    "prettier.requireConfig": true,

    "editor.defaultFormatter": "esbenp.prettier-vscode"

    // or specify a formatter separately for single language
    // "[javascript]": {
    //   "editor.defaultFormatter": "esbenp.prettier-vscode"
    // }
  }
  ```
