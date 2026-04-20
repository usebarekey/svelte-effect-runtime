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
import { Effect, Option, pipe, Schema } from "effect";
import { Command } from "svelte-effect-runtime";
import { Database } from "$lib/server/database";

export const like_post = Command(
  Schema.Struct({
    slug: Schema.String,
  }),
  ({ slug }) =>
    Effect.gen(function* () {
      const db = yield* Database;

      const [like] = yield* db.sql`
      update item
      set likes = likes + 1
      where slug = ${slug}
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
  import { get_posts, like_post } from "./data.remote";
  import { toast } from "svelte-sonner";

  const like = (slug: string) =>
    like_post({ slug }).pipe(
      Effect.tapError((err) =>
        Effect.sync(() => {
          toast.error(String(err));
        })
      ),
    );
</script>

<h1>Recent posts</h1>

<ul>
  {#each yield* get_posts() as { title, slug }}
    <li>
      <a href="/blog/{slug}">{title}</a>
      <button onclick={yield* like(slug)}>
        Like
      </button>
    </li>
  {/each}
</ul>
```
