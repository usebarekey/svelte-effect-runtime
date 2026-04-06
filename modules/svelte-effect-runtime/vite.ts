import {
  type Options as SveltePluginOptions,
  svelte,
} from "@sveltejs/vite-plugin-svelte";
import type { Plugin } from "vite";
import {
  effectPreprocess,
  type EffectPreprocessOptions,
} from "./preprocess.ts";

export interface SvelteEffectRuntimeOptions {
  effect?: EffectPreprocessOptions;
  svelte?: SveltePluginOptions;
}

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function svelteEffectRuntime(
  options: SvelteEffectRuntimeOptions = {},
): Plugin[] {
  const existingPreprocessors = arrayify(options.svelte?.preprocess);

  return svelte({
    ...options.svelte,
    preprocess: [
      effectPreprocess(options.effect),
      ...existingPreprocessors,
    ],
  });
}
