import { fileURLToPath, URL } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { sveltekitEffectRuntime } from "../../../dist/vite.js";
import { defineConfig } from "vite";

const fixtureRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fixtureRoot,
  plugins: [sveltekitEffectRuntime(), sveltekit()],
});
