import { defineConfig } from "vitepress";

export default defineConfig({
  title: "svelte-effect-runtime",
  description: "Effect for Svelte",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    sidebar: [
      {
        text: "Landing",
        items: [
          { text: "Getting Started", link: "/" },
          { text: "Tooling", link: "/tooling" },
          { text: "Best Practices", link: "/best-practices" },
        ],
      },
      {
        text: "Remote Functions",
        items: [
          { text: "Query", link: "/content/remote-functions/query" },
          { text: "Command", link: "/content/remote-functions/command" },
          { text: "Form", link: "/content/remote-functions/form" },
          { text: "Prerender", link: "/content/remote-functions/prerender" },
        ],
      },
      {
        text: "Runtimes",
        items: [
          { text: "Server", link: "/content/runtimes/server" },
          { text: "Client", link: "/content/runtimes/client" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Overview", link: "/content/reference/" },
          { text: "effect", link: "/content/reference/effect" },
          { text: "client-runtime", link: "/content/reference/client-runtime" },
          { text: "server-runtime", link: "/content/reference/server-runtime" },
          { text: "query", link: "/content/reference/query" },
          { text: "command", link: "/content/reference/command" },
          { text: "form", link: "/content/reference/form" },
          { text: "prerender", link: "/content/reference/prerender" },
          { text: "errors", link: "/content/reference/errors" },
          { text: "transport", link: "/content/reference/transport" },
          { text: "preprocess", link: "/content/reference/preprocess" },
          { text: "script-effect", link: "/content/reference/script-effect" },
          { text: "markup", link: "/content/reference/markup" },
          { text: "tooling", link: "/content/reference/tooling" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/usebarekey/svelte-effect-runtime",
      },
    ],
    search: {
      provider: "local",
    },
    outline: {
      level: [2, 3],
    },
    footer: {
      message: "BSD-3-Clause",
      copyright: "Barekey",
    },
  },
});
