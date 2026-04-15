import { copy } from "@std/fs/copy";
import { build } from "rolldown";
import { dirname, fromFileUrl, join, resolve } from "@std/path";

const package_dir = new URL("../modules/svelte-effect-runtime/", import.meta.url);
const repo_root = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const output_dir = join(repo_root, "dist", "svelte-effect-runtime");
const package_dist = new URL("./dist", package_dir).pathname;

await Deno.mkdir(output_dir, { recursive: true });
await Deno.remove(package_dist, { recursive: true }).catch(() => undefined);
await Deno.remove(output_dir, { recursive: true }).catch(() => undefined);
await Deno.mkdir(output_dir, { recursive: true });

const external = [
  /^\$app\/server$/,
  /^@sveltejs\/kit(?:\/.*)?$/,
  /^@sveltejs\/kit\/internal\/server$/,
  /^effect(?:\/.*)?$/,
  /^svelte(?:\/.*)?$/,
  /^vite$/,
  /^@sveltejs\/vite-plugin-svelte$/,
  /^typescript$/,
];

await build({
  input: {
    mod: new URL("./mod.ts", package_dir).pathname,
    "root-node": new URL("./root-node.ts", package_dir).pathname,
    effect: new URL("./effect.ts", package_dir).pathname,
    client: new URL("./client.ts", package_dir).pathname,
    server: new URL("./server.ts", package_dir).pathname,
    preprocess: new URL("./preprocess.ts", package_dir).pathname,
    vite: new URL("./vite.ts", package_dir).pathname,
    "language-server": new URL("./language-server.ts", package_dir).pathname,
    "internal/markup": new URL("./internal/markup.ts", package_dir).pathname,
    "internal/remote-client": new URL("./internal/remote-client.ts", package_dir).pathname,
    "internal/remote-shared": new URL("./internal/remote-shared.ts", package_dir).pathname,
    "internal/transform": new URL("./internal/transform.ts", package_dir).pathname,
  },
  output: {
    dir: output_dir,
    format: "esm",
    entryFileNames: "[name].js",
    chunkFileNames: "chunks/[name]-[hash].js",
    sourcemap: true,
  },
  external,
});

await copy(output_dir, package_dist, { overwrite: true });
