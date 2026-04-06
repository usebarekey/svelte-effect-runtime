import { build } from "rolldown";

const package_dir = new URL("../modules/svelte-effect-runtime/", import.meta.url);

const external = [
  /^effect(?:\/.*)?$/,
  /^svelte(?:\/.*)?$/,
  /^vite$/,
  /^@sveltejs\/vite-plugin-svelte$/,
  /^typescript$/,
];

await build({
  input: {
    mod: new URL("./mod.ts", package_dir).pathname,
    client: new URL("./client.ts", package_dir).pathname,
    preprocess: new URL("./preprocess.ts", package_dir).pathname,
    vite: new URL("./vite.ts", package_dir).pathname,
    "language-server": new URL("./language-server.ts", package_dir).pathname,
    "internal/markup": new URL("./internal/markup.ts", package_dir).pathname,
    "internal/transform": new URL("./internal/transform.ts", package_dir).pathname,
  },
  output: {
    dir: new URL("./dist/", package_dir).pathname,
    format: "esm",
    entryFileNames: "[name].js",
    chunkFileNames: "chunks/[name]-[hash].js",
    sourcemap: true,
  },
  external,
});
