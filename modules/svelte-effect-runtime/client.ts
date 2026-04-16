import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import { getContext, hasContext, onDestroy, setContext } from "svelte";
import {
  create_remote_domain_error,
  create_remote_http_error,
  create_remote_transport_error,
  create_remote_validation_error,
  is_serialized_remote_failure_envelope,
  REMOTE_ERROR_DECODER,
  type RemoteFailure,
} from "./internal/remote-shared.ts";

const EFFECT_RUNTIME_CONTEXT = Symbol.for("svelte-effect-runtime/runtime");
let current_client_runtime: EffectRuntime<unknown> | null = null;

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

export type {
  FormError,
  FormIssue,
  RemoteDomainError,
  RemoteFailure,
  RemoteHttpError,
  RemoteTransportError,
  RemoteValidationError,
} from "./internal/remote-shared.ts";

export interface ClientRuntimeService extends EffectRuntime<unknown> {}

export const ClientRuntimeTag = Context.GenericTag<ClientRuntimeService>(
  "svelte-effect-runtime/ClientRuntime",
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
    ? Out extends Layer.Layer<unknown, unknown, infer RIn>
      ? [RIn] extends [never] ? Out
      : never
    : never
    : never;

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

type ManagedRuntimeFromOps<Ops extends ReadonlyArray<RuntimeOperator>> =
  ManagedRuntime.ManagedRuntime<
    Layer.Layer.Success<FinalRuntimeLayer<Ops>>,
    Layer.Layer.Error<FinalRuntimeLayer<Ops>>
  >;

function pipeClientRuntime(): Layer.Layer<never>;
function pipeClientRuntime<
  const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>],
>(...ops: Ops): FinalRuntimeLayer<Ops>;
function pipeClientRuntime(
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

function makeClientRuntime(): ManagedRuntime.ManagedRuntime<never, never>;
function makeClientRuntime<
  const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>],
>(...ops: Ops): ManagedRuntimeFromOps<Ops>;
function makeClientRuntime(
  ...ops: [] | [RuntimeOperator, ...Array<RuntimeOperator>]
): ManagedRuntime.ManagedRuntime<never, unknown> {
  const layer = ops.length === 0 ? pipeClientRuntime() : pipeClientRuntime(
    ...(ops as [RuntimeOperator, ...Array<RuntimeOperator>]),
  );

  const runtime = track_client_runtime(ManagedRuntime.make(
    layer as unknown as Layer.Layer<unknown, unknown, never>,
  ));

  void current_client_runtime?.dispose().catch(() => undefined);
  current_client_runtime = runtime;

  if (is_component_context_available()) {
    return provideEffectRuntime(runtime, { disposeOnDestroy: true });
  }

  return runtime;
}

/**
 * A pass-through layer representing the dependency graph you want to include
 * in the client ManagedRuntime. Users can compose this directly:
 *
 *   ManagedRuntime.make(
 *     ClientRuntime.pipe(
 *       Layer.provide(MyApi.Live),
 *       Layer.provide(Logger.Live),
 *     ),
 *   )
 */
export const ClientRuntime: ClientRuntimeSeed = {
  pipe: pipeClientRuntime,
  make: makeClientRuntime,
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

  // No runtime registered — lazily create a default one with an empty layer.
  // This makes `ClientRuntime.make()` in `hooks.client.ts` optional for apps
  // that don't need to provide custom dependencies. A later explicit call to
  // `ClientRuntime.make(...)` will dispose this default and replace it.
  const default_runtime = track_client_runtime(
    ManagedRuntime.make(
      Layer.empty as unknown as Layer.Layer<unknown, unknown, never>,
    ),
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
  console.log("[svelte-effect-runtime][client]", "runInlineEffect:start");
  return runtime.runPromise(program).catch((error) => {
    console.error("[svelte-effect-runtime][client]", "runInlineEffect:error", {
      error,
    });
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

function is_redirect_like(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { location?: unknown }).location === "string" &&
      typeof (value as { status?: unknown }).status === "number",
  );
}

type Decode_remote_payload = <ErrorType = unknown>(
  encoded: string,
) => ErrorType;

function is_http_error_like(
  value: unknown,
): value is {
  readonly body?: unknown;
  readonly status?: number;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { status?: unknown }).status === "number",
  );
}

function get_error_status(value: unknown): number {
  return is_http_error_like(value) ? value.status ?? 500 : 500;
}

function get_remote_error_decoder(
  value: unknown,
): Decode_remote_payload | undefined {
  if (
    value &&
    (typeof value === "object" || typeof value === "function") &&
    REMOTE_ERROR_DECODER in value
  ) {
    return (value as { [REMOTE_ERROR_DECODER]: Decode_remote_payload })[
      REMOTE_ERROR_DECODER
    ];
  }
}

function decode_remote_error<ErrorType>(
  error: unknown,
  decode_payload?: Decode_remote_payload,
): RemoteFailure<ErrorType> {
  if (is_http_error_like(error)) {
    const body = error.body;

    if (is_serialized_remote_failure_envelope(body) && decode_payload) {
      try {
        return create_remote_domain_error<ErrorType>(
          decode_payload<ErrorType>(body.encoded),
          get_error_status(error),
        );
      } catch (cause) {
        return create_remote_transport_error(cause, body);
      }
    }

    if (get_error_status(error) === 400) {
      return create_remote_validation_error([], {
        body,
        status: 400,
      });
    }

    return create_remote_http_error(error, {
      body,
      status: get_error_status(error),
    });
  }

  return create_remote_http_error(error);
}

function create_remote_effect_from_promise<Success, ErrorType = never>(
  create_promise: () => PromiseLike<Success>,
  decode_error: (error: unknown) => RemoteFailure<ErrorType> = (error) =>
    create_remote_http_error(error),
): Effect.Effect<Success, RemoteFailure<ErrorType>, never> {
  return Effect.async<Success, RemoteFailure<ErrorType>>((resume) => {
    void Promise.resolve()
      .then(create_promise)
      .then(
        (value) => resume(Effect.succeed(value)),
        (error) => {
          if (is_redirect_like(error)) {
            resume(Effect.die(error));
            return;
          }

          resume(Effect.fail(decode_error(error)));
        },
      );
  });
}

type AnyCallable = (...args: Array<unknown>) => unknown;

export function to_effect<Success, ErrorType = never>(
  promise_like: PromiseLike<Success>,
): Effect.Effect<Success, RemoteFailure<ErrorType>, never>;
export function to_effect<Args extends Array<unknown>, Success, ErrorType = never>(
  fn: (...args: Args) => PromiseLike<Success>,
): (...args: Args) => Effect.Effect<Success, RemoteFailure<ErrorType>, never>;
export function to_effect<Success, ErrorType = never>(
  value: PromiseLike<Success> | AnyCallable,
): Effect.Effect<Success, RemoteFailure<ErrorType>, never> | AnyCallable {
  const decode_payload = get_remote_error_decoder(value);

  if (typeof value === "function") {
    return ((...args: Array<unknown>) =>
      create_remote_effect_from_promise(
        () => Promise.resolve((value as AnyCallable)(...args)),
        (error) => decode_remote_error<ErrorType>(error, decode_payload),
      )) as AnyCallable;
  }

  return create_remote_effect_from_promise(
    () => value,
    (error) => decode_remote_error<ErrorType>(error, decode_payload),
  );
}

export function to_native<Value>(
  value: Value,
): Value extends { native: infer Native } ? Native
  : Value;
export function to_native(value: unknown): unknown {
  let current = value;
  const seen = new Set<unknown>();

  while (
    current &&
    (typeof current === "object" || typeof current === "function") &&
    "native" in current
  ) {
    if (seen.has(current)) {
      break;
    }

    seen.add(current);
    current = (current as { native: unknown }).native;
  }

  return current;
}

export { create_remote_effect_from_promise, is_redirect_like };
