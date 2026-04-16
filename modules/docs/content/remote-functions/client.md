# Client Runtime

Remote functions are defined on the server, but their callable surfaces are used
from the browser. `svelte-effect-runtime` turns those browser-side call sites
into Effect programs, and those programs run through the client runtime.

```ts
import { ClientRuntime } from "svelte-effect-runtime";
```

This page explains what the client runtime is doing, when you need to configure
it, and how it interacts with remote adapters in the browser.

## What the client runtime does

On the client, `svelte-effect-runtime` uses the client runtime to execute
Effect-based browser code, including:

- `<script effect>` blocks
- inline event handlers that use `yield*`
- `{@render ...}` blocks lowered to Effect-backed snippets
- remote function calls that return `Effect`
- `Form.submit(...)` when you use the Effect-returning submit helper

For remote functions specifically, the client runtime powers the browser-side
adapters returned by `Query`, `Command`, `Prerender`, and `Form.submit(...)`.
Those adapters decode remote failures into Effect errors instead of throwing
plain transport exceptions.

## What this means for remote functions

When you import a remote function into a component, the browser-facing callable
surface is not just a `Promise` API. It is an Effect-aware API.

Examples:

- `Query(...)` returns an Effect-returning client callable.
- `Command(...)` returns an Effect-returning client callable with `pending`.
- `Prerender(...)` returns an Effect-returning client callable.
- `Form(...)` preserves the native form surface and also exposes `submit(...)`
  as an Effect.

That lets you compose remote calls with normal Effect operators on the client:

```svelte
<script lang="ts" effect>
  import { Effect } from "effect";
  import { get_post } from "./posts.remote";

  let slug = $state("intro");
  let post = $state<{ title: string } | null>(null);

  post = yield* get_post({ slug });

  const refresh = Effect.gen(function* () {
    post = yield* get_post({ slug });
  });
</script>

<button onclick={yield* refresh}>Refresh</button>
```

The remote function still executes on the server. The client runtime only runs
the browser-side Effect that initiates the call, awaits the response, and
decodes any remote failure into the Effect error channel.

## Default behavior

`ClientRuntime.make(...)` is optional.

If no client runtime has been registered yet, the first Effect-backed client
operation creates a default runtime with an empty layer automatically. That is
enough for:

- `<script effect>` code with no custom services
- remote function calls that do not require browser-provided services
- inline event handlers built from plain Effect operators

This works without `hooks.client.ts`:

```svelte
<script lang="ts" effect>
  import { get_version } from "./version.remote";

  let version = $state("");
  version = yield* get_version();
</script>

<p>{version}</p>
```

## When to call `ClientRuntime.make(...)`

Call `ClientRuntime.make(...)` when the browser-side Effect code around your
remote functions needs custom services.

Typical examples:

- a client logger
- a browser storage service
- a client-side API abstraction
- analytics or telemetry wrappers

The usual place to register those services is `src/hooks.client.ts`:

```ts
import { Layer } from "effect";
import { ClientRuntime } from "svelte-effect-runtime";
import { BrowserLogger } from "$lib/client/browser-logger";
import { DraftStore } from "$lib/client/draft-store";

export const init = () => {
  ClientRuntime.make(
    Layer.provide(BrowserLogger.Live),
    Layer.provide(DraftStore.Live),
  );
};
```

That global client runtime will then be reused by effect components and by the
Effect-backed remote adapters used in the browser.

## Component-local runtime overrides

Sometimes you want a subtree to use a different client runtime than the global
one. In that case, create a runtime manually and install it with
`provideEffectRuntime(...)`.

```svelte
<script lang="ts">
  import * as Layer from "effect/Layer";
  import { ClientRuntime, provideEffectRuntime } from "svelte-effect-runtime";
  import { FeatureFlags } from "$lib/client/feature-flags";

  const local_runtime = ClientRuntime.make(
    Layer.provide(FeatureFlags.Testing),
  );

  provideEffectRuntime(local_runtime, { disposeOnDestroy: true });
</script>
```

Inside that component subtree, Effect-backed remote calls and `<script effect>`
code will use the locally provided runtime first.

## What belongs in the client runtime

Put something in the client runtime if it is needed by browser-side Effect code,
for example:

- logging UI actions
- reading from `localStorage` or `sessionStorage`
- browser-only caches
- feature flags resolved in the browser

Do not put something in the client runtime if it should remain server-only:

- database access
- private API tokens
- server secrets
- request handling logic

Those belong in the [server runtime](/content/remote-functions/server), even if
the call is initiated from the browser.

## Error handling on the client

Client-side remote adapters translate remote failures into Effect errors. That
means browser code can stay in normal Effect style:

```ts
import { Effect } from "effect";
import { get_post } from "./posts.remote";

const program = Effect.match(get_post({ slug: "intro" }), {
  onSuccess: (post) => post,
  onFailure: (failure) => {
    console.error(failure);
    return null;
  },
});
```

The client runtime is what actually runs that program and gives it access to any
browser-side services you installed.

## How client and server runtimes fit together

A remote function call usually crosses both runtimes:

1. Browser-side Effect code runs in the client runtime.
2. The remote function callback runs in the server runtime.
3. The response is decoded back into the client-side Effect.

That split is useful:

- browser concerns stay in the client runtime
- server concerns stay in the server runtime
- the remote boundary is still expressed in Effect terms on both sides

## Choosing where a dependency should live

Ask two questions:

1. Does this dependency run in the browser, on the server, or both?
2. Is it needed before the remote request, during the remote callback, or after
   the response comes back?

Rules of thumb:

- browser-only dependencies go in `ClientRuntime.make(...)`
- server-only dependencies go in `ServerRuntime.make(...)`
- request-specific server data should be read from `RequestEvent`
- pure schemas and shared value types usually do not belong in either runtime

## Related pages

- [Query](/content/remote-functions/query)
- [Command](/content/remote-functions/command)
- [Form](/content/remote-functions/form)
- [Prerender](/content/remote-functions/prerender)
- [client-runtime reference](/content/reference/client-runtime)
