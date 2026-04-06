import type { PreprocessorGroup } from "svelte/compiler";
import { transformEffectMarkup } from "./internal/markup.ts";
import { transformEffectScript } from "./internal/transform.ts";

export interface EffectPreprocessOptions {
  runtimeModuleId?: string;
  effectModuleId?: string;
  svelteModuleId?: string;
}

export function effectPreprocess(
  options: EffectPreprocessOptions = {},
): PreprocessorGroup {
  return {
    name: "svelte-effect-runtime",
    markup({ content, filename }) {
      const transformed = transformEffectMarkup(content, {
        ...options,
        filename: filename ?? "Component.svelte",
      });

      if (transformed.code === content) {
        return;
      }

      return {
        code: transformed.code,
        map: transformed.map,
      };
    },
    script({ content, attributes, filename }) {
      if (
        attributes.context === "module" || !Object.hasOwn(attributes, "effect")
      ) {
        return;
      }

      const { effect: _effect, ...nextAttributes } = attributes;
      const transformed = transformEffectScript(content, {
        ...options,
        filename: filename ?? "Component.svelte",
      });

      return {
        code: transformed.code,
        map: transformed.map,
        attributes: nextAttributes,
      };
    },
  };
}
