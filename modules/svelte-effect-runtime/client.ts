import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import { getContext, hasContext, onDestroy, setContext } from "svelte";

const EFFECT_RUNTIME_CONTEXT = Symbol.for("svelte-effect-runtime/runtime");

export interface ProvideEffectRuntimeOptions {
  disposeOnDestroy?: boolean;
}

export interface ImportMetaLike {
  hot?: {
    dispose(callback: () => void): void;
  };
}

export interface EffectRuntime<R = unknown> {
  runCallback<A, E, R2>(
    effect: Effect.Effect<A, E, R2>,
    options?: {
      onExit?: (exit: Exit.Exit<A, E>) => void;
    },
  ): () => void;
  runPromise<A, E, R2>(effect: Effect.Effect<A, E, R2>): Promise<A>;
  dispose(): Promise<void>;
}

export interface SvelteRuntimeService extends EffectRuntime<unknown> {}

export const SvelteRuntimeTag = Context.GenericTag<SvelteRuntimeService>(
  "svelte-effect-runtime/SvelteRuntime",
);

type RuntimeSeedLayer<R> = Layer.Layer<R, never, R>;

function runtimeSeed<R>(): RuntimeSeedLayer<R> {
  return Layer.effectContext(Effect.context<R>());
}

type RuntimeOperator = (
  self: Layer.Layer<unknown, unknown, unknown>,
) => Layer.Layer<unknown, unknown, unknown>;

type ProvidedBy<Op> = Op extends
  (self: RuntimeSeedLayer<infer R>) => Layer.Layer<unknown, unknown, infer RIn>
  ? Exclude<R, RIn>
  : never;

type ProvidedByAll<Ops extends ReadonlyArray<RuntimeOperator>> = Ops extends
  readonly [infer Head, ...infer Tail] ?
    | ProvidedBy<Head>
    | ProvidedByAll<Extract<Tail, ReadonlyArray<RuntimeOperator>>>
  : never;

type ApplyOperator<Seed, Op> = Op extends (self: Seed) => infer Out ? Out
  : never;

type ApplyOperators<
  Seed,
  Ops extends ReadonlyArray<RuntimeOperator>,
> = Ops extends readonly [infer Head, ...infer Tail] ? ApplyOperators<
    ApplyOperator<Seed, Head>,
    Extract<Tail, ReadonlyArray<RuntimeOperator>>
  >
  : Seed;

type FinalRuntimeLayer<Ops extends ReadonlyArray<RuntimeOperator>> =
  ApplyOperators<RuntimeSeedLayer<ProvidedByAll<Ops>>, Ops> extends infer Out
    ? Out extends Layer.Layer<unknown, unknown, infer RIn> ? [RIn] extends [never] ? Out
      : never
    : never
    : never;

interface SvelteRuntimeSeed {
  pipe(): Layer.Layer<never>;
  pipe<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): FinalRuntimeLayer<Ops>;
  make(): ManagedRuntime.ManagedRuntime<never, never>;
  make<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): ManagedRuntimeFromOps<Ops>;
}

type ManagedRuntimeFromOps<Ops extends ReadonlyArray<RuntimeOperator>> =
  ManagedRuntime.ManagedRuntime<
    Layer.Layer.Success<FinalRuntimeLayer<Ops>>,
    Layer.Layer.Error<FinalRuntimeLayer<Ops>>
  >;

function pipeSvelteRuntime(): Layer.Layer<never>;
function pipeSvelteRuntime<
  const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>],
>(...ops: Ops): FinalRuntimeLayer<Ops>;
function pipeSvelteRuntime(
  ...ops: Array<RuntimeOperator>
): Layer.Layer<never, unknown, unknown> {
  if (ops.length === 0) {
    return Layer.empty;
  }

  return ops.reduce<Layer.Layer<unknown, unknown, unknown>>(
    (layer, op) => op(layer),
    runtimeSeed<unknown>(),
  ) as Layer.Layer<never, unknown, unknown>;
}

function makeSvelteRuntime(): ManagedRuntime.ManagedRuntime<never, never>;
function makeSvelteRuntime<
  const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>],
>(...ops: Ops): ManagedRuntimeFromOps<Ops>;
function makeSvelteRuntime(
  ...ops: [] | [RuntimeOperator, ...Array<RuntimeOperator>]
): ManagedRuntime.ManagedRuntime<never, unknown> {
  const layer = ops.length === 0 ? pipeSvelteRuntime() : pipeSvelteRuntime(
    ...(ops as [RuntimeOperator, ...Array<RuntimeOperator>]),
  );

  const runtime = ManagedRuntime.make(
    layer as unknown as Layer.Layer<unknown, unknown, never>,
  );

  return provideEffectRuntime(runtime, { disposeOnDestroy: true });
}

/**
 * A pass-through layer representing the dependency graph you want to include
 * in the client ManagedRuntime. Users can compose this directly:
 *
 *   ManagedRuntime.make(
 *     SvelteRuntime.pipe(
 *       Layer.provide(MyApi.Live),
 *       Layer.provide(Logger.Live),
 *     ),
 *   )
 */
export const SvelteRuntime: SvelteRuntimeSeed = {
  pipe: pipeSvelteRuntime,
  make: makeSvelteRuntime,
};

export function provideEffectRuntime<T extends EffectRuntime>(
  runtime: T,
  options: ProvideEffectRuntimeOptions = {},
): T {
  setContext(EFFECT_RUNTIME_CONTEXT, runtime);

  if (options.disposeOnDestroy) {
    onDestroy(() => {
      void runtime.dispose();
    });
  }

  return runtime;
}

export function getEffectRuntimeOrThrow<
  T extends EffectRuntime = EffectRuntime<never>,
>(): T {
  if (!hasContext(EFFECT_RUNTIME_CONTEXT)) {
    throw new Error(
      "No Effect runtime found. Call SvelteRuntime.make(...) or provideEffectRuntime(runtime) in a parent component before mounting a <script effect> component.",
    );
  }

  return getContext<T>(EFFECT_RUNTIME_CONTEXT);
}

export function runComponentEffect<A, E, R>(
  runtime: EffectRuntime<R>,
  program: Effect.Effect<A, E, R>,
): () => void {
  let disposed = false;

  const cancel = runtime.runCallback(program, {
    onExit(exit) {
      if (Exit.isFailure(exit) && !Exit.isInterrupted(exit)) {
        queueMicrotask(() => {
          throw Cause.squash(exit.cause);
        });
      }
    },
  });

  return () => {
    if (disposed) {
      return;
    }

    disposed = true;
    cancel();
  };
}

export function runInlineEffect<A, E, R>(
  runtime: EffectRuntime<R>,
  program: Effect.Effect<A, E, R>,
): Promise<A> {
  return runtime.runPromise(program).catch((error) => {
    queueMicrotask(() => {
      throw error;
    });

    throw error;
  });
}

export function registerHotDispose(
  meta: ImportMetaLike,
  cleanup: () => void,
): void {
  meta.hot?.dispose(cleanup);
}
