# Command

```ts
import { Command } from "svelte-effect-runtime";
```

```ts
declare const Command: (<Output, ErrorType, Requirements>(
  fn: () => Effect.Effect<Output, ErrorType, Requirements>,
) => EffectCommand<void, Output, ErrorType>) &
  (<Input, Output, ErrorType, Requirements>(
    validate: "unchecked",
    fn: (arg: Input) => Effect.Effect<Output, ErrorType, Requirements>,
  ) => EffectCommand<Input, Output, ErrorType>) &
  (<SchemaType extends EffectSchema, Output, ErrorType, Requirements>(
    validate: SchemaType,
    fn: (arg: SchemaOutput<SchemaType>) => Effect.Effect<Output, ErrorType, Requirements>,
  ) => EffectCommand<SchemaInput<SchemaType>, Output, ErrorType>);
```

The `Command` function is a wrapper over SvelteKit's `command`. The command
function, like form, allows you to write data to the server. Unlike form, it's
not specific to an element and can be called from anywhere.

<script setup>
import { Lightbulb } from "lucide-vue-next";
</script>

<div class="ser-callout">
  <Lightbulb class="ser-callout__icon" :size="20" />
  <p class="ser-callout__text">
    Prefer
    <code>form</code>
    where possible, since it gracefully degrades if JavaScript is disabled or fails to load.
  </p>
</div>

::: code-group

```ts [src/routes/blog/data.remote.ts]
import { Effect, Schema } from "effect";
import { Command } from "svelte-effect-runtime";
import { Database } from "$lib/server/database";

export const like_post = Command(
  Schema.Struct({
    slug: Effect.String,
  }),
  () =>
    Effect.gen(function* () {
      const db = yield* Database;

      const [like] = yield* Database.sql`
      update item
      set likes = likes + 1
      where id = ${id}
      returning
    `;

      return yield* pipe(
        like,
        Option.fromNullable,
        Option.match({
          onNone: () => Effect.fail(new Error("Post not found")),
        }),
      );
    }),
);
```

```svelte [src/routes/blog/+page.svelte]
<script lang="ts" effect>
  import { Effect } from "effect";
  import { like_post } from "./data.remote";
  import { toast } from "svelte-sonner";

  const like = Effect.gen(function* () {
    yield* pipe(
      yield* like_post,
      Effect.match({
        onFailure: (err) => toast.error(err);
      })
    )
  });
</script>

<h1>Recent posts</h1>

<ul>
  {#each await get_posts() as { title, slug }}
    <li>
      <a href="/blog/{slug}">{title}</a>
      <button onclick={yield* like({ slug })}>
        Like
      </button>
    </li>
  {/each}
</ul>
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
