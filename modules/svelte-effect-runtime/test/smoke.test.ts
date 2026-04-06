import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { workspaceFile } from "./helpers.ts";

async function runBuild(command: string[], cwd: string): Promise<void> {
  const process = new Deno.Command(command[0], {
    args: command.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await process.output();

  if (!output.success) {
    const stderr = new TextDecoder().decode(output.stderr);
    const stdout = new TextDecoder().decode(output.stdout);
    throw new Error(`${stdout}\n${stderr}`);
  }
}

Deno.test("plain Vite + Svelte fixture builds with the convenience plugin", async () => {
  const repoRoot = Deno.cwd();
  const fixtureRoot = join(repoRoot, "test/fixtures/plain-svelte");
  const distDir = join(fixtureRoot, "dist");
  await Deno.remove(distDir, { recursive: true }).catch(() => undefined);

  await runBuild([
    "node",
    workspaceFile("node_modules/vite/bin/vite.js"),
    "build",
    "--config",
    "vite.config.ts",
  ], fixtureRoot);

  const stat = await Deno.stat(join(distDir, "index.html"));
  assertEquals(stat.isFile, true);
});

Deno.test("SvelteKit fixture builds through the preprocess path", async () => {
  const repoRoot = Deno.cwd();
  const fixtureRoot = join(repoRoot, "test/fixtures/kit-app");
  const distDir = join(fixtureRoot, "build");
  await Deno.remove(distDir, { recursive: true }).catch(() => undefined);
  await Deno.remove(join(fixtureRoot, ".svelte-kit"), {
    recursive: true,
  }).catch(() => undefined);

  await runBuild([
    "node",
    workspaceFile("node_modules/vite/bin/vite.js"),
    "build",
    "--config",
    "vite.config.mjs",
  ], fixtureRoot);

  const stat = await Deno.stat(join(distDir, "index.html"));
  assertEquals(stat.isFile, true);
});
