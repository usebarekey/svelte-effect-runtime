import { build } from "rolldown";
import { dirname, fromFileUrl, join, resolve } from "@std/path";

const package_dir = new URL(
  "../modules/svelte-effect-runtime-language-server/",
  import.meta.url,
);
const repo_root = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const output_dir = join(repo_root, "dist", "svelte-effect-runtime-language-server");
const package_dist = new URL("./dist", package_dir).pathname;

await Deno.mkdir(output_dir, { recursive: true });
await Deno.remove(package_dist, { recursive: true }).catch(() => undefined);
await Deno.symlink(output_dir, package_dist, { type: "dir" });

await build({
  input: new URL("./server.ts", package_dir).pathname,
  output: {
    file: join(output_dir, "server.cjs"),
    format: "cjs",
    sourcemap: true,
    banner: "#!/usr/bin/env node",
  },
  external: [
    /^node:/,
    /^magic-string$/,
    /^@jridgewell\/trace-mapping$/,
    /^svelte-language-server$/,
  ],
});
