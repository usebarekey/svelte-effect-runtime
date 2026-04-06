export type { EffectPreprocessOptions } from "./preprocess.ts";
export type {
  EffectRuntime,
  ProvideEffectRuntimeOptions,
  SvelteRuntimeService,
} from "./client.ts";

export { effectPreprocess } from "./preprocess.ts";
export { transformEffectMarkup } from "./internal/markup.ts";
export { transformEffectScript } from "./internal/transform.ts";
export {
  getEffectRuntimeOrThrow,
  provideEffectRuntime,
  registerHotDispose,
  runComponentEffect,
  SvelteRuntime,
  SvelteRuntimeTag,
} from "./client.ts";
export { svelteEffectRuntime } from "./vite.ts";
