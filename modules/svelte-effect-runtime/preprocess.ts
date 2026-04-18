/**
 * Public preprocess entrypoint for `svelte-effect-runtime`.
 *
 * @example
 * ```ts
 * import { effect_preprocess } from "svelte-effect-runtime/preprocess";
 *
 * export default {
 *   preprocess: [effect_preprocess()],
 * };
 * ```
 *
 * @module
 */
import type { PreprocessorGroup } from "svelte/compiler";
import {
  effect_preprocess as create_effect_preprocess,
  type EffectPreprocessOptions,
} from "$/v3/preprocess.ts";

export type { EffectPreprocessOptions } from "$/v3/preprocess.ts";

/**
 * Low-level `.svelte` preprocessor used by the higher-level `effect()`
 * plugin.
 *
 * @see https://ser.barekey.dev/content/reference/preprocess
 */
export function effect_preprocess(
  options?: EffectPreprocessOptions,
): PreprocessorGroup {
  return create_effect_preprocess(options);
}
