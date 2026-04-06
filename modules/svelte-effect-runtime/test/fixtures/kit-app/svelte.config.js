import adapter from "@sveltejs/adapter-static";
import { fileURLToPath, URL } from "node:url";
import { effectPreprocess } from "../../../preprocess.ts";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/** @type {import("@sveltejs/kit").Config} */
const config = {
  preprocess: [
    effectPreprocess({
      runtimeModuleId: "ser/client",
    }),
  ],
  kit: {
    adapter: adapter(),
    alias: {
      ser: repoRoot,
    },
  },
};

export default config;
