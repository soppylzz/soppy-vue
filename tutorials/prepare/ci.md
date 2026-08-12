## Linter

### 1. Eslint

Javascript 校验自然选择 Eslint 完成，但 Markdown 规则校验工具在一开始我有两个选择：`@eslint/markdown` / `markdownlint` 。虽然 `markdownlint` 能对 Markdown 文本执行更加细致的[校验](https://github.com/DavidAnson/markdownlint#rules--aliases)，但因为以下原因我放弃了该方案：

- 没有集成对应规则的 fix 功能，只能使用 `markdownlint-cli2` 或者 `prettier` 作为候补方案；
- 对代码块（`<code>`）内嵌代码检测支持较弱，只能使用 `@eslint/markdown` 插件进行管理；
- 没有使用语义化规则代码（`MD001` - `heading-increment`）；

> 项目使用的 Eslint 版本为 `eslint@9`。Eslint 在 `v9` 引入了全新的 Flag Configuration<sup>「扁平配置」</sup> 模式，在配置结构、插件加载方式以及<u>扩展机制</u>上均与 `v8` 及更早版本存在显著差异。

Eslint 插件本质是 Eslint 的拓展模块，我们可以通过如下方式引入插件：

```js
import { defineConfig } from "eslint/config"
// third-party plugins
import xxx from "eslint-plugin-xxx"

// custom plugins
import processors from "./processors.js"
import languages from "./languages.js"
import rules from "./rules.js"

// defineConfig use jsDoc to validate configs
export default defineConfig([
  {
    plugins: {
      xxx,
      yyy: {
        meta: {
          name: "my-plugin",
          version: "0.0.1",
        },
        processors,
        languages,
        rules,
      },
    },
  },
])
```

Eslint 最初的设计目标非常纯粹——**校验 Javascript 代码**。其核心工作流是：先将 JS 代码解析为 ECAMScript AST<sup>ESTree</sup>，再由一系列 `rules` 遍历该 AST，完成静态分析与错误提示。

#### 🌔 Languages

随着生态演进，社区希望复用 Eslint 成熟的「规则驱动 + AST分析」能力，去校验 Javascript 以外的文件。为此，Eslint 将语法解析这一环节抽象为 `language` 接口：每种语言只需实现自己的解析器，即可接入 Eslint 的规则体系。

> Eslint 默认采用 Javascript parser 来实现 `AST` 转化，其 `languageOptions` 的设置项也是最丰富的，具体可以参考 [Eslint Docs - language-options](https://eslint.org/docs/latest/use/configure/language-options)，其中比较重要的有：
>
> - `ecmaVersion`、`sourceType`
> - `globals`：配置 JS 全局变量，一般根据代码运行环境设置。除了 `globals` ，`ecmaVersion` 也能在一定范围内推导全局变量；
>
> 此外，当我们使用了其他设置 `language` 的插件时，也可以根据其官方文档配置 `languageOptions`；

#### 🌕 Processors

在真实工程中，单一文件往往**混合多种语言**（例如 Vue SFC、Markdown）。此时仅靠 `languages` 并不够用——我们需要先从一个宿主文件中提取出特定语言的代码片段，再交由对应的 `language` + `rules` 进行分析。这正是 `processors` 的职责所在。其主要组成部分如下：

- `preprocessors`：负责从原始文本中提取子语言代码块（如 Markdown 中的 JS 代码块、Vue SFC 中的 `<script>` 块），将其包装为虚拟文件交给 Eslint。
- `postprocessors`：并在校验完成后，将报错位置映射回原文件。

#### 🌖 Example

一般的 Eslint 插件都在导出的 `plugin` 对象中提供了一些预设，直接使用预设可以帮我们省去插件注册步骤。具体结构可以参考 `@eslint/markdown` 插件源码：

```js
// @eslint/markdown
let recommendedPlugins, processorPlugins
const plugin = {
  meta: {
    name: "@eslint/markdown",
    version: "7.5.1", // x-release-please-version
  },

  // core components
  processors: {
    markdown: processor,
  },
  languages: {
    commonmark: new MarkdownLanguage({ mode: "commonmark" }),
    gfm: new MarkdownLanguage({ mode: "gfm" }),
  },
  rules,

  // presets for quick use
  configs: {
    "recommended-legacy": {/* omit */},
    recommended: [
      {
        name: "markdown/recommended",
        files: ["**/*.md"],
        language: "markdown/commonmark",
        // register with temp plugins
        plugins: (recommendedPlugins = {}),
        rules: recommendedRules,
      },
    ],
    processor: /** @type {Linter.Config[]} */ ([
      {
        name: "markdown/recommended/plugin",
        // register with temp plugins
        plugins: (processorPlugins = {}),
      },
      {
        name: "markdown/recommended/processor",
        files: ["**/*.md"],
        processor: "markdown/markdown",
      },
      {
        name: "markdown/recommended/code-blocks",
        files: ["**/*.md/**"],
        languageOptions: {
          parserOptions: {
            ecmaFeatures: {
              // Adding a "use strict" directive at the top of
              // every code block is tedious and distracting, so
              // opt into strict mode parsing without the
              // directive.
              impliedStrict: true,
            },
          },
        },
        rules: {
          ...processorRulesConfig,
        },
      },
    ]),
  },
}

// initialize recommend/processor preset at once
// @ts-expect-error
recommendedPlugins.markdown = processorPlugins.markdown = plugin
export default plugin
```

### 2. Commitlint

我们一般使用 Commitlint 不需要进行复杂的配置，这里简单介绍一下其与 `semantic-release`、`commitizen` 的配置：

- **`commitizen`**：Commitlint 推荐选择 `@commitlint/prompt` / **`@commitlint/cz-commitlint`** 与 Commitizen 共同使用，这需要在 `package.json` 配置：

  ```json
  {
    "scripts": {
      // use `cz` or `git-cz` to commit
      "commit": "cz"
    },
    "config": {
      "commitizen": {
        "path": "@commitlint/cz-commitlint"
      }
    }
  }
  ```

  > 相关文档：[Use prompt](https://commitlint.js.org/guides/use-prompt.html#an-alternative-to-commitlint-prompt-cli-commitizen)、[Prompt configuration](https://commitlint.js.org/reference/prompt.html#questions)；

- **`smantic-release`**：Commitlint 官方文档也提供了与 `semantic-release` 共享配置的说明：[Usage with semantic-release](https://commitlint.js.org/reference/configuration.html#usage-with-semantic-release)。

## Formatter

Prettier 在 `v1.8` 的时候引入了对 Markdown 文本的支持，其格式化对象大致有：列表、表格、内嵌代码以及文本片段。

- Markdown 支持可以参考这篇博客：[Prettier 1.8: Markdown Support](https://prettier.io/blog/2017/11/07/1.8.0)。
- 我们也可以通过其官网提供的[在线测试平台](https://prettier.io/playground/)进行调试。

> 注意 Markdown 的文本换行功能是配置 `proseWrap` ，而不是 `printWidth`；

需要注意的是，Prettier 与其他检测插件可能存在一些重复设置，在集成时需要安装一些辅助工具用于避免冲突，具体可以参考：[Related Projects](https://prettier.io/docs/related-projects)。

## CI

配置完上述工具后，我们需要将上述工具整合到 CI 流程中。这里我们主要使用：

- **`husky`**：负责管理 Git Hooks，Vue源码则采用 `simple-git-hooks`；

- **`lint-staged`**：基于 Git Staged<sup>「暂存区」</sup> 文件列表进行增量校验。工具会自动将文件提供给指定 linter / formatter 修改，最后将修改后的文件重新 `git add`；相应 `package.json` 配置如下：

  ```json
  {
    "lint-staged": {
      "*.{js,mjs,cjs,ts,json,md}": [
        "eslint --fix --concurrency=auto",
        "prettier --write --experimental-cli"
      ]
    }
  }
  ```
