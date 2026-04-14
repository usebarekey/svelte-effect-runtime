# svelte-effect-runtime

Client-side Effect runtime support for Svelte `<script>` blocks.

## What it does

- Adds an opt-in `<script effect>` preprocessor for Svelte components
- Hoists declarations and wraps top-level executable statements in
  `Effect.gen(...)`
- Runs the generated Effect once on mount
- Cancels it on unmount and HMR dispose
- Uses a parent-provided shared `ManagedRuntime`

## Deno tasks

```sh
deno task check
deno task test
```

## Main entrypoints

- `./mod.ts`
- `./client.ts`
- `./preprocess.ts`
- `./vite.ts`

## Runtime composition

```ts
import * as Layer from "effect/Layer";
import { ClientRuntime } from "@barekey/svelte-effect-runtime";

export const init = () => {
  ClientRuntime.make(
    Layer.provide(MyApi.Live),
    Layer.provide(Logger.Live),
  );
};
```
