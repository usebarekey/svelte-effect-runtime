# Server Runtime

Server runtime APIs provide the Effect environment for remote functions.

```ts
import {
  ServerRuntime,
  RequestEvent,
  get_server_runtime_or_throw
} from "svelte-effect-runtime";
```

## Signatures

```ts
interface ServerRuntimeSeed {
  pipe(): Layer.Layer<never>;
  pipe<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): FinalRuntimeLayer<Ops>;
  make(): void;
  make<const Ops extends readonly [RuntimeOperator, ...Array<RuntimeOperator>]>(
    ...ops: Ops
  ): void;
}
```

```ts
export type RequestEventService =
  ReturnType<typeof get_native_request_event>;

export const RequestEvent: Context.Tag<
  RequestEventService,
  RequestEventService
>;

export function get_server_runtime_or_throw():
  ManagedRuntime.ManagedRuntime<unknown, unknown>;
```

## Semantics

- `ServerRuntime.make(...)` constructs the active server runtime immediately.
- Calling it again replaces the active server runtime.
- `RequestEvent` is provided automatically during remote execution.
- Inside a remote Effect, use `yield* RequestEvent`.
