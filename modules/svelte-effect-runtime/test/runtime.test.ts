import { assertEquals, assertStringIncludes } from "@std/assert";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
  registerHotDispose,
  runComponentEffect,
  ClientRuntime,
} from "../client.ts";
import {
  compileFixtureModule,
  destroyComponent,
  flushEffects,
  installDom,
  mountComponent,
} from "./helpers.ts";

const runtimeModuleId =
  new URL("./support/client-runtime.ts", import.meta.url).href;

Deno.test("mounted effect components can assign into top-level Svelte state", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Counter from "./Counter.svelte";

  ClientRuntime.make();
</script>

<Counter />
`,
        "Counter.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";
  const count = yield* Effect.succeed(42);
</script>

<p>{count}</p>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    await flushEffects();

    assertStringIncludes(dom.document.body.textContent ?? "", "42");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("later declarations can use yielded values like normal Effect code", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Counter from "./Counter.svelte";

  ClientRuntime.make();
</script>

<Counter />
`,
        "Counter.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  const count = yield* Effect.succeed(21);
  const doubled = count * 2;
</script>

<p>{count} / {doubled}</p>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    await flushEffects();

    assertStringIncludes(dom.document.body.textContent ?? "", "21 / 42");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("component unmount cancels the running effect", async () => {
  const dom = installDom();

  try {
    const events: string[] = [];
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Worker from "./Worker.svelte";

  let { events } = $props<{ events: string[] }>();
  ClientRuntime.make();
</script>

<Worker {events} />
`,
        "Worker.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  let { events } = $props<{ events: string[] }>();

  events.push("started");
  yield* Effect.async<void>(() =>
    Effect.sync(() => {
      events.push("interrupted");
    })
  );
</script>

<p>running</p>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body, { events });
    await flushEffects();
    await destroyComponent(app);
    await flushEffects();

    assertEquals(events, ["started", "interrupted"]);
  } finally {
    dom.cleanup();
  }
});

Deno.test("effect components with no provided services mount via the default runtime", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "Standalone.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";
  let count = $state(0);
  count = yield* Effect.succeed(1);
</script>

<p>{count}</p>
`,
      },
      "Standalone.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    await flushEffects();

    assertStringIncludes(dom.document.body.textContent ?? "", "1");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("ClientRuntime.make auto-provides services to effect components", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "service.ts": `import * as Context from "effect/Context";

export const NumberService = Context.GenericTag<{ readonly value: number }>(
  "test/NumberService"
);
`,
        "App.svelte": `<script lang="ts">
  import * as Layer from "effect/Layer";
  import { ClientRuntime } from "${runtimeModuleId}";
  import { NumberService } from "./service.ts";
  import Counter from "./Counter.svelte";

  ClientRuntime.make(
    Layer.provide(Layer.succeed(NumberService, { value: 42 })),
  );
</script>

<Counter />
`,
        "Counter.svelte": `<script lang="ts" effect>
  import { NumberService } from "./service.ts";

  let count = $state(0);
  let numberService: { readonly value: number };
  numberService = yield* NumberService;
  count = numberService.value;
</script>

<p>{count}</p>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    await flushEffects();

    assertStringIncludes(dom.document.body.textContent ?? "", "42");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("destructuring yielded values works in effect declarations", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Counter from "./Counter.svelte";

  ClientRuntime.make();
</script>

<Counter />
`,
        "Counter.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  const { value } = yield* Effect.succeed({ value: 42 });
</script>

<p>{value}</p>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    await flushEffects();

    assertStringIncludes(dom.document.body.textContent ?? "", "42");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("markup helpers support inline handlers and block expressions", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Demo from "./Demo.svelte";

  ClientRuntime.make();
</script>

<Demo />
`,
        "Demo.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  let count = $state(2);

  function increment() {
    return Effect.sync(() => {
      count += 1;
      return count;
    });
  }

  function showList() {
    return Effect.succeed(true);
  }

  function loadItems() {
    return Effect.succeed([1, 2]);
  }

  function label(item: number) {
    return Effect.succeed(\`item:\${item}\`);
  }
</script>

<button onclick={() => yield* increment()}>Increment</button>

{#if yield* showList()}
  {#each yield* loadItems() as item}
    <p>{yield* label(item)}</p>
  {/each}
{/if}

{#await yield* Effect.succeed(Promise.resolve("done")) then value}
  <span>{value}</span>
{/await}

<strong>{count}</strong>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    for (let iteration = 0; iteration < 4; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "item:1");
    assertStringIncludes(dom.document.body.textContent ?? "", "item:2");
    assertStringIncludes(dom.document.body.textContent ?? "", "done");

    dom.document.querySelector("button")?.dispatchEvent(
      new dom.document.defaultView!.Event("click", { bubbles: true }),
    );
    for (let iteration = 0; iteration < 3; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "1");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("markup helpers still work when Svelte experimental async mode is enabled", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Demo from "./Demo.svelte";

  ClientRuntime.make();
</script>

<Demo />
`,
        "Demo.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  let count = $state(2);

  const increment = Effect.gen(function* () {
    count *= count;
  });

  const decrement = Effect.gen(function* () {
    count /= count;
  });
</script>

<button onclick={() => yield* increment}>Increment</button>
<button onclick={() => yield* decrement}>Decrement</button>
<p>Count: {count}</p>
`,
      },
      "App.svelte",
      {
        runtimeModuleId,
        compileOptions: {
          experimental: {
            async: true,
          },
        },
      },
    );

    const app = await mountComponent(module, dom.document.body);
    for (let iteration = 0; iteration < 3; iteration += 1) {
      await flushEffects();
    }

    dom.document.querySelector("button")?.dispatchEvent(
      new dom.document.defaultView!.Event("click", { bubbles: true }),
    );

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "Count: 4");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("inline yield event handlers respect exact effect semantics from the component", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Demo from "./Demo.svelte";

  ClientRuntime.make();
</script>

<Demo />
`,
        "Demo.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  let count = $state(0);

  const increment = Effect.gen(function* () {
    count = count * count;
    console.log(count);
  });

  const decrement = Effect.gen(function* () {
    count = count / count;
    console.log(count);
  });
</script>

<button id="inc" onclick={() => yield* increment}>Increment</button>
<button id="dec" onclick={() => yield* decrement}>Decrement</button>
<p>Count: {count}</p>
`,
      },
      "App.svelte",
      {
        runtimeModuleId,
        compileOptions: {
          experimental: {
            async: true,
          },
        },
      },
    );

    const app = await mountComponent(module, dom.document.body);
    for (let iteration = 0; iteration < 3; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "Count: 0");

    dom.document.getElementById("inc")?.dispatchEvent(
      new dom.document.defaultView!.Event("click", { bubbles: true }),
    );

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "Count: 0");

    dom.document.getElementById("dec")?.dispatchEvent(
      new dom.document.defaultView!.Event("click", { bubbles: true }),
    );

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "Count: NaN");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("failed effects surface as uncaught client errors", async () => {
  const runtime = ManagedRuntime.make(Layer.empty);
  const originalQueueMicrotask = globalThis.queueMicrotask;
  let captured: unknown;

  globalThis.queueMicrotask = ((callback: VoidFunction) => {
    try {
      callback();
    } catch (error) {
      captured = error;
    }
  }) as typeof queueMicrotask;

  try {
    const cleanup = runComponentEffect(runtime, Effect.fail(new Error("boom")));
    await flushEffects();
    cleanup();

    assertEquals((captured as Error)?.message, "boom");
  } finally {
    globalThis.queueMicrotask = originalQueueMicrotask;
    await runtime.dispose();
  }
});

Deno.test("hmr dispose wiring forwards cleanup callbacks", () => {
  let disposed = false;
  let registered: (() => void) | undefined;

  registerHotDispose(
    {
      hot: {
        dispose(callback) {
          registered = callback;
        },
      },
    },
    () => {
      disposed = true;
    },
  );

  registered?.();
  assertEquals(disposed, true);
});

Deno.test("ClientRuntime composes through Layer.provide for runtime dependencies", async () => {
  const NumberService = Context.GenericTag<{ readonly value: number }>(
    "test/NumberService",
  );

  const runtime = ManagedRuntime.make(
    ClientRuntime.pipe(
      Layer.provide(Layer.succeed(NumberService, { value: 42 })),
    ),
  );

  try {
    const value = await runtime.runPromise(
      Effect.map(NumberService, (service) => service.value),
    );

    assertEquals(value, 42);
  } finally {
    await runtime.dispose();
  }
});

Deno.test("ClientRuntime unions multiple provided services into one runtime", async () => {
  const NumberService = Context.GenericTag<{ readonly value: number }>(
    "test/NumberService",
  );
  const TextService = Context.GenericTag<{ readonly value: string }>(
    "test/TextService",
  );

  const runtime = ManagedRuntime.make(
    ClientRuntime.pipe(
      Layer.provide(Layer.succeed(NumberService, { value: 42 })),
      Layer.provide(Layer.succeed(TextService, { value: "ready" })),
    ),
  );

  try {
    const value = await runtime.runPromise(
      Effect.all([
        Effect.map(NumberService, (service) => service.value),
        Effect.map(TextService, (service) => service.value),
      ]),
    );

    assertEquals(value, [42, "ready"]);
  } finally {
    await runtime.dispose();
  }
});

Deno.test("{@render yield* fn(arg)} mounts the returned snippet", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import { ClientRuntime } from "${runtimeModuleId}";
  import Demo from "./Demo.svelte";

  ClientRuntime.make();
</script>

<Demo />
`,
        "Demo.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  let current = $state("A");

  function pickSnippet(value: string) {
    return Effect.succeed(value === "A" ? snippetA : snippetB);
  }
</script>

{#snippet snippetA()}
  <p data-key="a">alpha</p>
{/snippet}

{#snippet snippetB()}
  <p data-key="b">beta</p>
{/snippet}

<div>
  {@render yield* pickSnippet(current)}
</div>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    for (let iteration = 0; iteration < 4; iteration += 1) {
      await flushEffects();
    }

    assertStringIncludes(dom.document.body.textContent ?? "", "alpha");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});

Deno.test("effect components mount without an explicit ClientRuntime.make() call", async () => {
  const dom = installDom();

  try {
    const module = await compileFixtureModule(
      {
        "App.svelte": `<script lang="ts">
  import Counter from "./Counter.svelte";
</script>

<Counter />
`,
        "Counter.svelte": `<script lang="ts" effect>
  import { Effect } from "effect";

  const value = yield* Effect.succeed(7);
</script>

<p>{value}</p>
`,
      },
      "App.svelte",
      { runtimeModuleId },
    );

    const app = await mountComponent(module, dom.document.body);
    await flushEffects();

    assertStringIncludes(dom.document.body.textContent ?? "", "7");
    await destroyComponent(app);
  } finally {
    dom.cleanup();
  }
});
