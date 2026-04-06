import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
  getContext,
  hasContext,
  onDestroy,
  setContext,
} from "../../../../node_modules/svelte/src/index-client.js";

const EFFECT_RUNTIME_CONTEXT = Symbol.for("svelte-effect-runtime/runtime");

export interface ProvideEffectRuntimeOptions {
  disposeOnDestroy?: boolean;
}

export interface EffectRuntime<R = unknown> {
  runCallback<A, E>(
    effect: Effect.Effect<A, E, R>,
    options?: {
      onExit?: (exit: Exit.Exit<A, E>) => void;
    },
  ): () => void;
  runPromise<A, E>(effect: Effect.Effect<A, E, R>): Promise<A>;
  dispose(): Promise<void>;
}

export interface ImportMetaLike {
  hot?: {
    dispose(callback: () => void): void;
  };
}

type RuntimeOperator = (
  self: Layer.Layer<unknown, unknown, unknown>,
) => Layer.Layer<unknown, unknown, unknown>;

function runtimeSeed<R>(): Layer.Layer<R, never, R> {
  return Layer.effectContext(Effect.context<R>());
}

function pipeSvelteRuntime(...ops: Array<RuntimeOperator>): Layer.Layer<never> {
  if (ops.length === 0) {
    return Layer.empty;
  }

  return ops.reduce<Layer.Layer<unknown, unknown, unknown>>(
    (layer, op) => op(layer),
    runtimeSeed<unknown>(),
  ) as Layer.Layer<never>;
}

export const SvelteRuntime = {
  pipe: pipeSvelteRuntime,
  make(...ops: Array<RuntimeOperator>) {
    const runtime = ManagedRuntime.make(
      pipeSvelteRuntime(...ops) as Layer.Layer<unknown, unknown, never>,
    );

    return provideEffectRuntime(runtime, { disposeOnDestroy: true });
  },
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
