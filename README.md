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
deno add @barekey/svelte-effect-runtime
pnpm add @barekey/svelte-effect-runtime
bun add @barekey/svelte-effect-runtime
```

### Add the preprocessor to your Svelte config

And in your `svelte.config.js`:

```diff
+ import { effectPreprocess } from "svelte-effect-runtime/preprocess";

  export default {
+   preprocess: [effectPreprocess()],
  };
```

### Create a runtime in your root layout

In your `routes/+layout.svelte`:

```svelte
<script lang="ts">
  import { Layer } from "effect";
  import { SvelteRuntime } from "svelte-effect-runtime/client";

  const { children } = $props();

  SvelteRuntime.make(
    Layer.empty,
  );
</script>

{@render children?.()}
```
