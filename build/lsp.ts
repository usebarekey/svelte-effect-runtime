import { build } from "rolldown";

const package_dir = new URL(
  "../modules/svelte-effect-runtime-language-server/",
  import.meta.url,
);

await build({
  input: new URL("./server.ts", package_dir).pathname,
  output: {
    file: new URL("./dist/server.cjs", package_dir).pathname,
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
