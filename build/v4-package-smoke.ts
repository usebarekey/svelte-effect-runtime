import { dirname, fromFileUrl, join, resolve } from "@std/path";

const repo_root = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const package_dir = join(repo_root, "modules", "svelte-effect-runtime");
const temp_dir = await Deno.makeTempDir({ prefix: "ser-v4-package-smoke-" });
const npm = Deno.build.os === "windows" ? "npm.cmd" : "npm";
const npx = Deno.build.os === "windows" ? "npx.cmd" : "npx";

const package_json = {
  name: "ser-v4-package-smoke",
  private: true,
  type: "module",
};

const tsconfig_json = {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: true,
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    types: ["node"],
    lib: ["ES2022", "DOM"],
  },
  include: ["test.ts"],
};

const test_ts = `import { ClientRuntime } from "svelte-effect-runtime/v4";
import { Form, ServerRuntime } from "svelte-effect-runtime/v4/_server";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const Input = Schema.Struct({ value: Schema.String });

ServerRuntime.make();
ClientRuntime.make();

export const form = Form(Input, ({ data }) => Effect.succeed(data.value));
`;

await Deno.writeTextFile(
  join(temp_dir, "package.json"),
  `${JSON.stringify(package_json, null, 2)}\n`,
);
await Deno.writeTextFile(
  join(temp_dir, "tsconfig.json"),
  `${JSON.stringify(tsconfig_json, null, 2)}\n`,
);
await Deno.writeTextFile(join(temp_dir, "test.ts"), test_ts);

try {
  const pack_output = await run_command(
    npm,
    ["pack", package_dir, "--json"],
    temp_dir,
  );
  const packed = JSON.parse(pack_output.stdout) as Array<{ filename: string }>;
  const tarball = packed[0]?.filename;

  if (!tarball) {
    throw new Error("npm pack did not return a tarball filename.");
  }

  await run_command(
    npm,
    [
      "install",
      "--no-package-lock",
      "effect@beta",
      "typescript",
      "@types/node",
      tarball,
    ],
    temp_dir,
  );

  await run_command(
    npx,
    ["tsc", "--noEmit"],
    temp_dir,
  );

  console.log("[svelte-effect-runtime]", "v4 package smoke passed", {
    temp_dir,
  });

  await Deno.remove(temp_dir, { recursive: true });
} catch (error) {
  console.error("[svelte-effect-runtime]", "v4 package smoke failed", {
    temp_dir,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function run_command(
  command: string,
  args: Array<string>,
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const result = await new Deno.Command(command, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();

  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);

  if (!result.success) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        stdout.trim(),
        stderr.trim(),
      ].filter(Boolean).join("\n\n"),
    );
  }

  return { stdout, stderr };
}
