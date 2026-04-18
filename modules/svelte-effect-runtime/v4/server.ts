import type {
  RemoteForm as SvelteKitRemoteForm,
  RemoteFormInput as SvelteKitRemoteFormInput,
} from "@sveltejs/kit";
import type { getRequestEvent as get_native_request_event } from "$app/server";
import type { Effect as Effect_type, Layer as Layer_type } from "effect";
import * as base_server from "$/v3/server.ts";
import type { FormError, RemoteFailure } from "$internal/remote-shared.ts";
import {
  type EffectContextKey,
  type EffectSchemaLike,
  make_context_key,
} from "$internal/effect-compat.ts";

export interface Transporter<T = unknown, U = { value: unknown }> {
  decode: (data: U) => T;
  encode: (value: T) => false | U;
}

export type Transport = Record<string, Transporter>;

export type RemoteFormInput = SvelteKitRemoteFormInput;

export type RemoteQueryFunction<Input, Output> = (
  arg: OptionalArgument<Input>,
) => Promise<Output>;

export type RemoteCommand<Input, Output> =
  & ((
    arg: OptionalArgument<Input>,
  ) => Promise<Output> & {
    updates(...updates: Array<unknown>): Promise<Output>;
  })
  & {
    readonly pending: number;
  };

export type RemotePrerenderFunction<Input, Output> = (
  arg: OptionalArgument<Input>,
) => Promise<Output>;

export type RemoteForm<Input extends RemoteFormInput | void, Output> =
  SvelteKitRemoteForm<Input, Output>;

type OptionalArgument<Input> = undefined extends Input ? Input | void : Input;

type RuntimeOperator = (self: unknown) => unknown;

type SchemaInput<SchemaType extends EffectSchemaLike> = SchemaType extends
  { readonly Encoded: infer Input } ? Input
  : never;

type SchemaOutput<SchemaType extends EffectSchemaLike> = SchemaType extends
  { readonly Type: infer Output } ? Output
  : never;

type FieldHelpers<FormShape, SchemaType> = FormShape extends
  Record<string, unknown> ? {
    [Key in keyof FormShape as Key extends string ? Key : never]: (
      message: string,
    ) => Effect_type.Effect<never, FormError<SchemaType>, never>;
  }
  : Record<PropertyKey, never>;

export type Invalid<SchemaType = unknown> =
  & {
    form: (
      message: string,
    ) => Effect_type.Effect<never, FormError<SchemaType>, never>;
  }
  & FieldHelpers<
    SchemaType extends EffectSchemaLike ? SchemaOutput<SchemaType> : unknown,
    SchemaType
  >;

export type EffectQueryFunction<Input, Output, Error = never> =
  & ((
    arg: OptionalArgument<Input>,
  ) => Effect_type.Effect<
    Output,
    RemoteFailure<Error>,
    never
  >)
  & {
    native: RemoteQueryFunction<Input, Output>;
  };

export type EffectCommand<Input, Output, Error = never> =
  & ((
    arg: OptionalArgument<Input>,
  ) => Effect_type.Effect<
    Output,
    RemoteFailure<Error>,
    never
  >)
  & {
    native: RemoteCommand<Input, Output>;
    readonly pending: number;
  };

export type EffectPrerenderFunction<Input, Output, Error = never> =
  & ((
    arg: OptionalArgument<Input>,
  ) => Effect_type.Effect<
    Output,
    RemoteFailure<Error>,
    never
  >)
  & {
    native: RemotePrerenderFunction<Input, Output>;
  };

export type EffectForm<
  Input extends RemoteFormInput | void,
  Output,
  Error = never,
> = RemoteForm<Input, Output> & {
  native: RemoteForm<Input, Output>;
  submit(
    data: OptionalArgument<Input>,
  ): Effect_type.Effect<
    Output,
    RemoteFailure<Error>,
    never
  >;
  for: RemoteForm<Input, Output>["for"] extends
    (...args: infer Args) => infer Result
    ? (...args: Args) => EffectForm<Input, Output, Error> & Result
    : never;
};

export type RequestEventService = ReturnType<typeof get_native_request_event>;

export interface ServerRuntimeSeed {
  pipe(): Layer_type.Layer<never>;
  pipe<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): unknown;
  make(): void;
  make<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): void;
}

export interface EffectManagedRuntime {
  runPromiseExit<A, E, R>(
    effect: Effect_type.Effect<A, E, R>,
  ): Promise<unknown>;
  dispose(): Promise<void>;
}

export interface EffectQueryBatchFactory {
  (...args: Array<unknown>): unknown;
}

export interface EffectQueryFactory {
  <Output, Error, Requirements>(
    fn: () => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectQueryFunction<void, Output, Error>;
  <Input, Output, Error, Requirements>(
    validate: "unchecked",
    fn: (arg: Input) => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectQueryFunction<Input, Output, Error>;
  <SchemaType extends EffectSchemaLike, Output, Error, Requirements>(
    validate: SchemaType,
    fn: (
      arg: SchemaOutput<SchemaType>,
    ) => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectQueryFunction<SchemaInput<SchemaType>, Output, Error>;
  batch: EffectQueryBatchFactory;
}

export interface EffectCommandFactory {
  <Output, Error, Requirements>(
    fn: () => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectCommand<void, Output, Error>;
  <Input, Output, Error, Requirements>(
    validate: "unchecked",
    fn: (arg: Input) => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectCommand<Input, Output, Error>;
  <SchemaType extends EffectSchemaLike, Output, Error, Requirements>(
    validate: SchemaType,
    fn: (
      arg: SchemaOutput<SchemaType>,
    ) => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectCommand<SchemaInput<SchemaType>, Output, Error>;
}

type RemotePrerenderInputsGenerator<Input> = (
  event: RequestEventService,
) => AsyncIterable<Input> | Iterable<Input>;

export interface EffectFormFactory {
  <Output, Error, Requirements>(
    fn: () => Effect_type.Effect<Output, Error, Requirements>,
  ): EffectForm<void, Output, Error>;
  <Input extends RemoteFormInput, Output, Error, Requirements>(
    validate: "unchecked",
    fn: (
      args: {
        data: Input;
        invalid: Invalid;
      },
    ) => Effect_type.Effect<Output, Error | FormError, Requirements>,
  ): EffectForm<Input, Output, Error>;
  <SchemaType extends EffectSchemaLike, Output, Error, Requirements>(
    validate: SchemaType,
    fn: (
      args: {
        data: SchemaOutput<SchemaType>;
        invalid: Invalid<SchemaType>;
      },
    ) => Effect_type.Effect<
      Output,
      Error | FormError<SchemaType>,
      Requirements
    >,
  ): EffectForm<SchemaInput<SchemaType> & RemoteFormInput, Output, Error>;
}

export interface EffectPrerenderFactory {
  <Output, Error, Requirements>(
    fn: () => Effect_type.Effect<Output, Error, Requirements>,
    options?: {
      inputs?: RemotePrerenderInputsGenerator<void>;
      dynamic?: boolean;
    },
  ): EffectPrerenderFunction<void, Output, Error>;
  <Input, Output, Error, Requirements>(
    validate: "unchecked",
    fn: (arg: Input) => Effect_type.Effect<Output, Error, Requirements>,
    options?: {
      inputs?: RemotePrerenderInputsGenerator<Input>;
      dynamic?: boolean;
    },
  ): EffectPrerenderFunction<Input, Output, Error>;
  <SchemaType extends EffectSchemaLike, Output, Error, Requirements>(
    validate: SchemaType,
    fn: (
      arg: SchemaOutput<SchemaType>,
    ) => Effect_type.Effect<Output, Error, Requirements>,
    options?: {
      inputs?: RemotePrerenderInputsGenerator<SchemaInput<SchemaType>>;
      dynamic?: boolean;
    },
  ): EffectPrerenderFunction<SchemaInput<SchemaType>, Output, Error>;
}

export const Query: EffectQueryFactory = base_server.Query;
export const Command: EffectCommandFactory = base_server.Command;
export const Form: EffectFormFactory = base_server.Form;
export const Prerender: EffectPrerenderFactory = base_server.Prerender;
export const RequestEvent = make_context_key<
  RequestEventService,
  RequestEventService
>(
  "svelte-effect-runtime/RequestEvent",
) as
  & EffectContextKey<RequestEventService, RequestEventService>
  & Effect_type.Effect<RequestEventService, never, RequestEventService>;
export const ServerRuntime: ServerRuntimeSeed = base_server.ServerRuntime;
export const create_effect_transport:
  typeof base_server.create_effect_transport =
    base_server.create_effect_transport;
export const get_server_runtime_or_throw: () => EffectManagedRuntime =
  base_server.get_server_runtime_or_throw;
/**
 * Remap low-level request-store crashes into a clearer setup error when remote
 * helpers are evaluated outside SvelteKit's remote-function runtime.
 *
 * @internal Internal - do not use.
 */
export const normalize_remote_helper_error =
  base_server.normalize_remote_helper_error;
