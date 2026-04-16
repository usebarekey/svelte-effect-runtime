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
let current_client_runtime: EffectRuntime<unknown> | null = null;

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

function pipeClientRuntime(...ops: Array<RuntimeOperator>): Layer.Layer<never> {
  if (ops.length === 0) {
    return Layer.empty;
  }

  return ops.reduce<Layer.Layer<unknown, unknown, unknown>>(
    (layer, op) => op(layer),
    runtimeSeed<unknown>(),
  ) as Layer.Layer<never>;
}

export const ClientRuntime = {
  pipe: pipeClientRuntime,
  make(...ops: Array<RuntimeOperator>) {
    const runtime = track_client_runtime(ManagedRuntime.make(
      pipeClientRuntime(...ops) as Layer.Layer<unknown, unknown, never>,
    ));

    void current_client_runtime?.dispose().catch(() => undefined);
    current_client_runtime = runtime;

    if (is_component_context_available()) {
      return provideEffectRuntime(runtime, { disposeOnDestroy: true });
    }

    return runtime;
  },
};

export function provideEffectRuntime<T extends EffectRuntime>(
  runtime: T,
  options: ProvideEffectRuntimeOptions = {},
): T {
  current_client_runtime = track_client_runtime(runtime);
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
  if (has_runtime_context()) {
    return getContext<T>(EFFECT_RUNTIME_CONTEXT);
  }

  if (current_client_runtime !== null) {
    return current_client_runtime as T;
  }

  const default_runtime = track_client_runtime(
    ManagedRuntime.make(Layer.empty as Layer.Layer<unknown, unknown, never>),
  );
  current_client_runtime = default_runtime;
  return default_runtime as unknown as T;
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

function has_runtime_context(): boolean {
  try {
    return hasContext(EFFECT_RUNTIME_CONTEXT);
  } catch {
    return false;
  }
}

function is_component_context_available(): boolean {
  try {
    void hasContext(EFFECT_RUNTIME_CONTEXT);
    return true;
  } catch {
    return false;
  }
}

function track_client_runtime<T extends EffectRuntime>(runtime: T): T {
  const tracked_runtime = runtime as T & { __ser_tracked__?: true };

  if (tracked_runtime.__ser_tracked__ === true) {
    return tracked_runtime;
  }

  const dispose = runtime.dispose.bind(runtime);
  tracked_runtime.__ser_tracked__ = true;
  runtime.dispose = (() => {
    if (current_client_runtime === tracked_runtime) {
      current_client_runtime = null;
    }

    return dispose();
  }) as typeof runtime.dispose;

  return tracked_runtime;
}
