<script setup>
import { Lightbulb } from "lucide-vue-next";
</script>

# Best Practices

## Error handling

When using remote functions or code intended to be used by the client, consider using Effect's error handling via `Effect.fail` with tagged errors. Tagged errors allow the client to differentiate between errors over the network.

<div class="ser-callout">
  <Lightbulb class="ser-callout__icon" :size="20" />
  <p class="ser-callout__text">
    While you can create a shared file in <code>$lib</code> for errors, the client can infer the errors returned automatically.
    Remember that it uses the string given in <code>Data.TaggedError(...)</code> to do this.
  </p>
</div>

::: code-group

```ts [src/routes/blog/data.remote.ts]
import { Data, Effect, Option, Schema, pipe } from "effect";
import { Query } from "svelte-effect-runtime";
import { Database } from "$lib/server/database";

class NoPostFoundError extends Data.TaggedError("NoPostFoundError")<{}> {}

export const get_post_by_slug = Query(
    Schema.Struct({
        slug: Schema.String,
    }),
    ({ slug }) =>
        Effect.gen(function* () {
            const db = yield* Database;

            const [row] = yield* db.sql`
                select * from post
                where slug = ${slug}
            `;

            return pipe(
                post,
                Option.fromNullable,
                Option.match({
                    onNone: () => Effect.fail(new NoPostFoundError()),
                    onSome: (p) => Effect.succeed(p),
                }),
            );
        }),
);
```

```svelte [src/routes/blog/[slug]/+page.svelte]
<script lang="ts" effect>
    import { Effect } from "effect";
    import { toast } from "svelte-sonner";
    import { page } from "$app/state";
    import { get_post_by_slug } from "../data.remote";

    const post = yield* get_post_by_slug({ slug: page.params.slug }).pipe(
        Effect.catchTags({
            NoPostFoundError: () => 
                Effect.sync(() => 
                    toast.error(`No post found for ${page.params.slug}.`)
                ),
        }),
    );
</script>

{#if post}
    {@html post.content}
{/if}
```

:::
