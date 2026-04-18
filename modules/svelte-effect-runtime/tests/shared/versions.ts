import * as v3_client from "$/v3/client.ts";
import { toFileUrl } from "@std/path";
import * as v3_server from "$/v3/server.ts";
import { effect_preprocess as v3_preprocess } from "$/v3/preprocess.ts";
import {
  svelte_effect_runtime as v3_svelte_effect_runtime,
  sveltekit_effect_runtime as v3_sveltekit_effect_runtime,
} from "$/v3/vite.ts";
import * as v4_client from "$/v4/client.ts";
import * as v4_server from "$/v4/server.ts";
import { effect_preprocess as v4_preprocess } from "$/v4/preprocess.ts";
import {
  svelte_effect_runtime as v4_svelte_effect_runtime,
  sveltekit_effect_runtime as v4_sveltekit_effect_runtime,
} from "$/v4/vite.ts";
import { repoFile } from "$tests/shared/support.ts";

export interface PackageImportSurface {
  preprocess: Array<string>;
  runtime: Array<string>;
  server: Array<string>;
  vite: Array<string>;
}

export interface BuildVariant {
  name: string;
  preprocessImport: string;
  runtimeImport: string;
  viteImport: string;
}

export interface VersionHarness {
  buildVariants: Array<BuildVariant>;
  client: Pick<
    typeof v3_client,
    | "ClientRuntime"
    | "get_effect_runtime_or_throw"
    | "run_component_effect"
    | "run_inline_effect"
    | "to_effect"
    | "to_native"
  >;
  label: "v3" | "v4";
  packageImports: PackageImportSurface;
  preprocess: typeof v3_preprocess;
  runtimeModuleUrl: string;
  serverModuleUrl: string;
  server: typeof v3_server | typeof v4_server;
  vite: {
    svelte_effect_runtime: typeof v3_svelte_effect_runtime;
    sveltekit_effect_runtime: typeof v3_sveltekit_effect_runtime;
  };
}

function buildVariant(
  name: string,
  runtimeImport: string,
  preprocessImport: string,
  viteImport: string,
): BuildVariant {
  return {
    name,
    preprocessImport,
    runtimeImport,
    viteImport,
  };
}

export const v3_harness: VersionHarness = {
  buildVariants: [
    buildVariant(
      "default",
      "svelte-effect-runtime",
      "svelte-effect-runtime/preprocess",
      "svelte-effect-runtime/vite",
    ),
    buildVariant(
      "explicit-v3",
      "svelte-effect-runtime/v3",
      "svelte-effect-runtime/v3/preprocess",
      "svelte-effect-runtime/v3/vite",
    ),
  ],
  client: v3_client,
  label: "v3",
  packageImports: {
    preprocess: [
      "svelte-effect-runtime/preprocess",
      "svelte-effect-runtime/v3/preprocess",
    ],
    runtime: [
      "svelte-effect-runtime",
      "svelte-effect-runtime/v3",
    ],
    server: [
      "svelte-effect-runtime/_server",
      "svelte-effect-runtime/v3/_server",
    ],
    vite: [
      "svelte-effect-runtime/vite",
      "svelte-effect-runtime/v3/vite",
    ],
  },
  preprocess: v3_preprocess,
  runtimeModuleUrl: toFileUrl(repoFile("tests/support/client-runtime.ts")).href,
  serverModuleUrl: toFileUrl(repoFile("v3/server.ts")).href,
  server: v3_server,
  vite: {
    svelte_effect_runtime: v3_svelte_effect_runtime,
    sveltekit_effect_runtime: v3_sveltekit_effect_runtime,
  },
};

export const v4_harness: VersionHarness = {
  buildVariants: [
    buildVariant(
      "v4",
      "svelte-effect-runtime/v4",
      "svelte-effect-runtime/v4/preprocess",
      "svelte-effect-runtime/v4/vite",
    ),
  ],
  client: v4_client,
  label: "v4",
  packageImports: {
    preprocess: ["svelte-effect-runtime/v4/preprocess"],
    runtime: ["svelte-effect-runtime/v4"],
    server: ["svelte-effect-runtime/v4/_server"],
    vite: ["svelte-effect-runtime/v4/vite"],
  },
  preprocess: v4_preprocess,
  runtimeModuleUrl: toFileUrl(repoFile("tests/support/client-runtime.ts")).href,
  serverModuleUrl: toFileUrl(repoFile("v4/server.ts")).href,
  server: v4_server,
  vite: {
    svelte_effect_runtime: v4_svelte_effect_runtime,
    sveltekit_effect_runtime: v4_sveltekit_effect_runtime,
  },
};
