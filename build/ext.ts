import { build } from "rolldown";

const package_dir = new URL(
  "../modules/svelte-effect-runtime-vscode-extension/",
  import.meta.url,
);

await build({
  input: {
    extension: new URL("./extension.ts", package_dir).pathname,
    server: new URL("./server.ts", package_dir).pathname,
  },
  output: {
    dir: new URL("./dist/", package_dir).pathname,
    format: "cjs",
    entryFileNames: "[name].cjs",
    chunkFileNames: "chunks/[name]-[hash].cjs",
    sourcemap: true,
  },
  external: [
    /^node:/,
    /^vscode$/,
    /^magic-string$/,
    /^@jridgewell\/trace-mapping$/,
    /^svelte-language-server$/,
  ],
});
