import type { VersionHarness } from "$tests/shared/versions.ts";
import { join } from "@std/path";
import {
  makeTempWorkspace,
  repoFile,
  runCommand,
  writeFixtureTree,
} from "$tests/shared/support.ts";

const npm = Deno.build.os === "windows" ? "npm.cmd" : "npm";
const npx = Deno.build.os === "windows" ? "npx.cmd" : "npx";

let package_build_queue: Promise<void> = Promise.resolve();

async function with_package_build_lock<T>(work: () => Promise<T>): Promise<T> {
  const pending = package_build_queue.then(work, work);
  package_build_queue = pending.then(() => undefined, () => undefined);
  return await pending;
}

async function pack_runtime_package(): Promise<string> {
  const package_dir = repoFile("");
  const temp_dir = await makeTempWorkspace("package-pack-");

  await runCommand("deno", ["task", "build"], package_dir);
  const output = await runCommand(
    npm,
    ["pack", package_dir, "--json"],
    temp_dir,
  );
  const packed = JSON.parse(output.stdout) as Array<{ filename: string }>;
  const tarball = packed[0]?.filename;

  if (!tarball) {
    throw new Error("npm pack did not return a tarball filename.");
  }

  return join(temp_dir, tarball);
}

function create_public_surface_program(harness: VersionHarness): string {
  const runtime_imports = harness.packageImports.runtime.map((
    specifier,
    index,
  ) => `import * as runtime_${index} from "${specifier}";`).join("\n");
  const preprocess_imports = harness.packageImports.preprocess.map((
    specifier,
    index,
  ) => `import * as preprocess_${index} from "${specifier}";`).join("\n");
  const vite_imports = harness.packageImports.vite.map((specifier, index) =>
    `import * as vite_${index} from "${specifier}";`
  ).join("\n");
  const server_imports = harness.packageImports.server.map((specifier, index) =>
    `import * as server_${index} from "${specifier}";`
  ).join("\n");

  const runtime_assertions = harness.packageImports.runtime.map((
    _specifier,
    index,
  ) =>
    [
      `runtime_${index}.ClientRuntime.make();`,
      `runtime_${index}.to_effect(Promise.resolve("ok"));`,
      `runtime_${index}.to_native({ native: "value" });`,
    ].join("\n")
  ).join("\n");
  const preprocess_assertions = harness.packageImports.preprocess.map((
    _specifier,
    index,
  ) => `preprocess_${index}.effect_preprocess();`).join("\n");
  const vite_assertions = harness.packageImports.vite.map((_specifier, index) =>
    [
      `vite_${index}.svelte_effect_runtime();`,
      `vite_${index}.sveltekit_effect_runtime();`,
    ].join("\n")
  ).join("\n");
  const server_assertions = harness.packageImports.server.map((
    _specifier,
    index,
  ) =>
    [
      `server_${index}.ServerRuntime.make();`,
      `server_${index}.create_effect_transport({ Sample });`,
      `server_${index}.Query(() => Effect.succeed("ok"));`,
      `server_${index}.Form(Sample, ({ data, invalid }) => {`,
      `  data.title satisfies string;`,
      `  invalid.title("title");`,
      `  return Effect.succeed(data.title);`,
      `});`,
      `server_${index}.Query(() =>`,
      `  Effect.gen(function* () {`,
      `    const request_event = yield* server_${index}.RequestEvent;`,
      `    request_event.cookies.get("session");`,
      `    return "ok";`,
      `  })`,
      `);`,
    ].join("\n")
  ).join("\n");

  return [
    `import * as Effect from "effect/Effect";`,
    `import * as Schema from "effect/Schema";`,
    runtime_imports,
    preprocess_imports,
    vite_imports,
    server_imports,
    `const Sample = Schema.Struct({ title: Schema.String });`,
    runtime_assertions,
    preprocess_assertions,
    vite_assertions,
    server_assertions,
  ].join("\n\n");
}

export function register_public_surface_behaviors(
  harness: VersionHarness,
): void {
  Deno.test(
    `[${harness.label}] published package entrypoints type-check from consumer code`,
    async () => {
      await with_package_build_lock(async () => {
        const tarball = await pack_runtime_package();
        const temp_dir = await makeTempWorkspace(
          `surface-${harness.label}-consumer-`,
        );
        const effect_dependency = harness.label === "v4"
          ? "effect@beta"
          : "effect@^3.21.0";

        await writeFixtureTree(temp_dir, {
          "package.json": JSON.stringify(
            {
              name: `ser-${harness.label}-surface-smoke`,
              private: true,
              type: "module",
            },
            null,
            2,
          ),
          "test.ts": create_public_surface_program(harness),
          "tsconfig.json": JSON.stringify(
            {
              compilerOptions: {
                lib: ["ES2022", "DOM"],
                module: "NodeNext",
                moduleResolution: "NodeNext",
                skipLibCheck: true,
                strict: true,
                target: "ES2022",
                types: ["node"],
                verbatimModuleSyntax: true,
              },
              include: ["test.ts"],
            },
            null,
            2,
          ),
        });

        await runCommand(
          npm,
          [
            "install",
            "--no-package-lock",
            effect_dependency,
            "typescript",
            "@types/node",
            tarball,
          ],
          temp_dir,
        );
        await runCommand(npx, ["tsc", "--noEmit"], temp_dir);
      });
    },
  );
}
