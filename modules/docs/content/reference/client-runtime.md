# Client Runtime

Client runtime APIs are used by `<script effect>` components and by the client-side remote adapters.

```ts
import {
  ClientRuntime,
  provideEffectRuntime,
  getEffectRuntimeOrThrow,
  runComponentEffect,
  runInlineEffect,
  registerHotDispose
} from "svelte-effect-runtime";
```

## Signatures

```ts
interface ClientRuntimeSeed {
  pipe(): Layer.Layer<never>;
  pipe<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): FinalRuntimeLayer<Ops>;

  make(): ManagedRuntime.ManagedRuntime<never, never>;
  make<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): ManagedRuntimeFromOps<Ops>;
}
```

```ts
export interface EffectRuntime<R = unknown> {
  runCallback<A, E, R2>(
    effect: Effect.Effect<A, E, R2>,
    options?: { onExit?: (exit: Exit.Exit<A, E>) => void }
  ): () => void;
  runPromise<A, E, R2>(effect: Effect.Effect<A, E, R2>): Promise<A>;
  dispose(): Promise<void>;
}
```

```ts
export function provideEffectRuntime<T extends EffectRuntime>(
  runtime: T,
  options?: { disposeOnDestroy?: boolean }
): T;

export function getEffectRuntimeOrThrow<
  T extends EffectRuntime = EffectRuntime<never>
>(): T;

export function runComponentEffect<A, E, R>(
  runtime: EffectRuntime<R>,
  program: Effect.Effect<A, E, R>
): () => void;

export function runInlineEffect<A, E, R>(
  runtime: EffectRuntime<R>,
  program: Effect.Effect<A, E, R>
): Promise<A>;

export function registerHotDispose(
  meta: ImportMetaLike,
  cleanup: () => void
): void;
```

## Semantics

- `ClientRuntime.make(...)` builds a `ManagedRuntime`.
- If called from `hooks.client.ts`, the runtime is stored globally for subsequent effect components.
- If called from a component, the runtime is also placed into Svelte context and disposed on component destroy.
- Calling `ClientRuntime.make(...)` again replaces the active client runtime.
- `getEffectRuntimeOrThrow()` first checks Svelte context, then the global runtime. If neither is set, a default runtime with an empty layer is created automatically — `ClientRuntime.make()` is optional and only needed when you want to provide custom services or layers.

## Default runtime

Calling `ClientRuntime.make()` from `hooks.client.ts` is **optional**. When no runtime has been registered, the first `<script effect>` component to mount creates a default runtime automatically. This is sufficient for effects that do not depend on any custom services.

If your effects use `Context` services, call `ClientRuntime.make(...)` with the appropriate layers before any component mounts:

```ts
// src/hooks.client.ts
import { ClientRuntime } from "svelte-effect-runtime";
import { MyApi } from "$lib/my-api";
import { Layer } from "effect";

export const init = () => {
  ClientRuntime.make(Layer.provide(MyApi.Live));
};
```
