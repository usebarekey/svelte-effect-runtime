# svelte-effect-runtime

An experimental project to allow Effect.ts to execute in Svelte components,
allowing you todo this:

```svelte
<script lang="ts" effect>
  import { Effect } from "effect";

  let count = $state(0);
  const increment = Effect.gen(function* () {
    count = count + 1;
  });

  const decrement = Effect.gen(function* () {
    count = count - 1;
  });
</script>

<button onclick={() => yield* increment}>Increment</button>
<button onclick={() => yield* decrement}>Decrement</button>
<p>{count}</p>
```

## Getting started

### Install the runtime

Install `svelte-effect-runtime` to your Svelte project:

```sh
deno add npm:@barekey/svelte-effect-runtime
pnpm add @barekey/svelte-effect-runtime
bun add @barekey/svelte-effect-runtime
```

### Add the preprocessor to your Svelte config

And in your `svelte.config.js`:

```diff
+ import { effectPreprocess } from "@barekey/svelte-effect-runtime/preprocess";

  export default {
+   preprocess: [effectPreprocess()],
  };
```

### Create a runtime in your client hook

```ts
import * as Layer from "effect/Layer";
import { ClientRuntime } from "@barekey/svelte-effect-runtime";

export const init = () => {
  ClientRuntime.make(
    Layer.empty,
  );
};
```

## Notes

### Enabling Effect in a component
To enable Effect, add `effect` in your `<script>` tag.

### This is still a beta
I haven't properly tested it, so expect bugs! You can expedite this process by reporting issues though.

And in your `src/hooks.server.ts` if you need server-side services:

```ts
import * as Layer from "effect/Layer";
import { ServerRuntime } from "@barekey/svelte-effect-runtime";

export const init = () => {
  ServerRuntime.make(
    Layer.empty,
  );
};
```

You do not need to create the runtime in a layout anymore.

And thats it! You can now use Effect.ts in your Svelte components.

## LSP

You can install the VSIX 
