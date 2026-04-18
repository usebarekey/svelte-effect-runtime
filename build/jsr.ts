import { dirname, fromFileUrl, join, resolve } from "@std/path";

const repo_root = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const runtime_dir = join(repo_root, "modules", "svelte-effect-runtime");
const package_json_path = join(runtime_dir, "package.json");
const deno_json_path = join(runtime_dir, "deno.json");
const package_name = Deno.env.get("JSR_PACKAGE_NAME");

if (!package_name) {
  throw new Error("JSR_PACKAGE_NAME environment variable is required.");
}

const package_json = JSON.parse(await Deno.readTextFile(package_json_path));
const deno_json = JSON.parse(await Deno.readTextFile(deno_json_path));

const jsr_ready_deno_json = {
  ...deno_json,
  name: package_name,
  version: package_json.version,
  license: package_json.license,
  exports: {
    ".": "./mod.ts",
    "./_server": "./server.ts",
    "./language-server": "./language-server.ts",
  },
};

await Deno.writeTextFile(
  deno_json_path,
  `${JSON.stringify(jsr_ready_deno_json, null, 2)}\n`,
);
