# svelte-effect-runtime

`svelte-effect-runtime` is a Vite plugin for SvelteKit allowing native
[Effect](https://effect.website/) code execution.

## Installing

Get started by downloading the NPM package.

```sh
deno add npm:svelte-effect-runtime
```

```sh
bun add svelte-effect-runtime
```

```sh
pnpm add svelte-effect-runtime
```

### LSP and VSIX extension

You can optionally install the [LSP](/tooling) and the
[VSIX extension](/tooling) to help your text editor understand the extended
syntax.

### Adding it to your project

In your `vite.config.ts` file, add the following:

```diff
+ import { effect } from "svelte-effect-runtime";

export default defineConfig({ 
-   plugins: [sveltekit()],
+   plugins: [effect(), sveltekit()],
});
```

It is important that `effect()` comes first and before `sveltekit()` as it does
heavy transformations to the codebase.

## Client

`svelte-effect-runtime` allows Effect code execution in clients natively. To
work nicely with libaries, Enabling Effect is opt-in per file via the `effect`
tag in a `<script>` block. See the example below:

```svelte
<script lang="ts" effect>
    const rng = Effect.succeed(Math.random());
</script>

{yield* rng}
```

## Server

On the server, `svelte-effect-runtime` gives you wrappers around
[Query](content/remote-functions/query), [Form](content/remote-functions/form),
[Command](content/remote-functions/command), and
[Prerender](content/remote-functions/prerender) functions.

## Runtime

If you are familiar with Effect, you might be wondering how to fufill various
[requirements](https://effect.website/docs/requirements-management/services/)
for your application. Luckily, we give you two handy helpers for crafting both a
client and server runtime.

<script setup>
import { Lightbulb } from "lucide-vue-next";
</script>

<div class="ser-callout">
  <Lightbulb class="ser-callout__icon" :size="20" />
  <p class="ser-callout__text">
    Registering a runtime in `hooks.client.ts` or `hooks.server.ts` is optional.
    A default empty-layer runtime is created lazily when nothing has been
    registered yet.
  </p>
</div>

### Creating the client Runtime

For the client, create your runtime in your `hooks.client.ts`:

```ts
import { ClientRuntime } from "svelte-effect-runtime";

export const init = () => {
  ClientRuntime.make(
    Layer.provide(...)
  );
}
```

### Creating the server runtime

For the server, create your runtime in `hooks.server.ts` when your remote
Effects need custom services:

```ts
import { ServerRuntime } from "svelte-effect-runtime";

export const init = () => {
  ServerRuntime.make(
    Layer.provide(...)
  );
}
```

<style>
.ser-callout {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  margin: 1.25rem 0;
}

.ser-callout__icon {
  color: var(--vp-c-tip-1);
  flex: 0 0 auto;
}

.ser-callout__text {
  margin: 0;
  line-height: 1.8;
  text-wrap: pretty;
}
</style>
