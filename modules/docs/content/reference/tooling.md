# tooling

Tooling support spans preprocess, Vite integration, language-server wiring, and
the VSIX extension.

## Vite layer

These are advanced subpath exports. Most SvelteKit apps should use `effect()`
from `"svelte-effect-runtime"` and compose it with `sveltekit()`.

```ts
import {
  svelteEffectRuntime,
  sveltekitEffectRuntime,
} from "svelte-effect-runtime/vite";
```

```ts
export interface SvelteEffectRuntimeOptions {
  effect?: EffectPreprocessOptions;
  svelte?: SveltePluginOptions;
}

export interface SveltekitEffectRuntimeOptions {
  remoteModuleId?: string;
}

export function svelteEffectRuntime(
  options?: SvelteEffectRuntimeOptions,
): Plugin[];

export function sveltekitEffectRuntime(
  options?: SveltekitEffectRuntimeOptions,
): Plugin;
```

## Notes

- `effect()` is a companion plugin and should be composed with `sveltekit()`.
- `effectPreprocess(...)` lives at `"svelte-effect-runtime/preprocess"`.
- the custom language server and VSIX smooth over `yield*` syntax in editors
- the Vite/SvelteKit build path is the source of truth
