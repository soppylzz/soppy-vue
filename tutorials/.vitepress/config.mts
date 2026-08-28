import { defineConfig } from "vitepress"

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "soppy-vue",
  description: "A from-scratch reimplementation of Vue",
  base: "/",
  cleanUrls: true,
  vite: {
    server: {
      port: 1234,
      open: true,
    },
  },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#faf9f5" }],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
        crossorigin: "true",
      },
    ],
    [
      "link",
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "true",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap",
      },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@latest/style.css",
      },
    ],
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/wordmark.png",
    // header shows the logo only — no text next to it
    siteTitle: false,
    nav: [
      { text: "教程", link: "/tutorials/prepare/intro" },
      // { text: "测试", link: "/coverage", target: "_blank", rel: "noopener" },
    ],

    sidebar: [
      {
        text: "工程准备",
        items: [
          { text: "组合式 API", link: "/tutorials/prepare/intro" },
          { text: "环境搭建", link: "/tutorials/prepare/env" },
          { text: "Lint 与 CI", link: "/tutorials/prepare/ci" },
          { text: "发布与 CD", link: "/tutorials/prepare/cd" },
        ],
      },
      {
        text: "响应式系统",
        items: [
          { text: "Proxy", link: "/tutorials/reactivity/base" },
          { text: "Computed", link: "/tutorials/reactivity/point" },
          { text: "类型工具", link: "/tutorials/reactivity/type" },
        ],
      },
      {
        text: "运行时",
        items: [
          { text: "Runtime", link: "/tutorials/runtime/intro" },
          { text: "DOM", link: "/tutorials/runtime/dom" },
          { text: "Diff", link: "/tutorials/runtime/diff" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/soppylzz/soppy-vue" }],

    outline: { label: "本页导航", level: [2, 3] },
    docFooter: { prev: "上一篇", next: "下一篇" },
    lastUpdated: { text: "最后更新于" },
    darkModeSwitchLabel: "外观",
    sidebarMenuLabel: "目录",
    returnToTopLabel: "返回顶部",
    langMenuLabel: "切换语言",
  },
})
