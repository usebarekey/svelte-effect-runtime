import { preprocess } from "svelte/compiler";
import type { Plugin, PluginOption } from "vite";
import {
  effectPreprocess,
  type EffectPreprocessOptions,
} from "./preprocess.ts";
import { sveltekitEffectRuntime } from "./vite.ts";

export interface EffectPluginOptions {
  effect?: EffectPreprocessOptions;
  remoteModuleId?: string;
}

function create_effect_svelte_transform(
  options: EffectPreprocessOptions = {},
): Plugin {
  const preprocessor = effectPreprocess(options);

  return {
    name: "svelte-effect-runtime-transform",
    enforce: "pre",
    async transform(code, id, _options) {
      const filename = id.split("?", 1)[0];
      if (!filename.endsWith(".svelte")) {
        return null;
      }

      const transformed = await preprocess(code, preprocessor, { filename });
      if (transformed.code === code) {
        return null;
      }

      return {
        code: transformed.code,
        map: transformed.map ?? null,
      } as any;
    },
  };
}

export function effect(
  options: EffectPluginOptions = {},
): PluginOption[] {
  const transform_plugin = create_effect_svelte_transform(options.effect);

  return [
    transform_plugin,
    sveltekitEffectRuntime({
      remoteModuleId: options.remoteModuleId,
    }),
  ];
}
