import { build } from "rolldown";
import { dirname, fromFileUrl, join, resolve } from "@std/path";

const package_dir = new URL(
  "../modules/svelte-effect-runtime-vscode-extension/",
  import.meta.url,
);
const repo_root = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const output_dir = join(repo_root, "dist", "svelte-effect-runtime-vscode-extension");
const package_dist = new URL("./dist", package_dir).pathname;

await Deno.mkdir(output_dir, { recursive: true });
await Deno.remove(package_dist, { recursive: true }).catch(() => undefined);
await Deno.symlink(output_dir, package_dist, { type: "dir" });

await build({
  input: {
    extension: new URL("./extension.ts", package_dir).pathname,
    server: new URL("./server.ts", package_dir).pathname,
  },
  output: {
    dir: output_dir,
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
