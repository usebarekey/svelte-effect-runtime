# Query

```ts
import { Query } from "svelte-effect-runtime";
```

```ts
declare const Query:
  & (<Output, ErrorType, Requirements>(
    fn: () => Effect.Effect<Output, ErrorType, Requirements>,
  ) => EffectQueryFunction<void, Output, ErrorType>)
  & (<Input, Output, ErrorType, Requirements>(
    validate: "unchecked",
    fn: (arg: Input) => Effect.Effect<Output, ErrorType, Requirements>,
  ) => EffectQueryFunction<Input, Output, ErrorType>)
  & (<SchemaType extends EffectSchema, Output, ErrorType, Requirements>(
    validate: SchemaType,
    fn: (
      arg: SchemaOutput<SchemaType>,
    ) => Effect.Effect<Output, ErrorType, Requirements>,
  ) => EffectQueryFunction<SchemaInput<SchemaType>, Output, ErrorType>);
```

The `Query` function is a wrapper over SvelteKit's `query`. It allows you to
read dynamic data from the server (for static data, consider using
[prerender](/content/remote-functions/prerender) instead):

::: code-group

```ts [src/routes/blog/data.remote.ts]
import { Effect } from "effect";
import { Query } from "svelte-effect-runtime";
import { Database } from "$lib/server/database";

export const get_posts = Query(Effect.gen(function* () {
  const db = yield* Database;

  return yield* Database.sql`
    select title, slug
		from post
		order by published_at
		desc
	`;
}));

export const get_post_by_slug = Query(
  Effect.Struct({
    slug: Effect.String,
  }),
  Effect.gen(function* () {
    const db = yield* Database;

    const [post] = yield* Database.sql`
      select * from post
      where slug = ${slug}
    `;

    return yield* pipe(
      post,
      Option.fromNullable,
      Option.match({
        onNone: () => Effect.fail(new Error("Post not found")),
        onSome: (post) => post,
      }),
    );
  }),
);
```

```svelte [src/routes/blog/+page.svelte]
<script lang="ts" effect>
  import { get_posts } from "./data.remote";
</script>

<h1>Recent posts</h1>

<ul>
  {#each await get_posts() as { title, slug }}
    <li><a href="/blog/{slug}">{title}</a></li>
  {/each}
</ul>
```
