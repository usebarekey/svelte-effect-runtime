# Prerender

```ts
import { Prerender } from "svelte-effect-runtime";
```

```ts
declare const Prerender:
  & (<Output, ErrorType, Requirements>(
    fn: () => Effect.Effect<Output, ErrorType, Requirements>,
    options?: {
      inputs?: (
        event: RequestEventService,
      ) => AsyncIterable<void> | Iterable<void>;
      dynamic?: boolean;
    },
  ) => EffectPrerenderFunction<void, Output, ErrorType>)
  & (<Input, Output, ErrorType, Requirements>(
    validate: "unchecked",
    fn: (arg: Input) => Effect.Effect<Output, ErrorType, Requirements>,
    options?: {
      inputs?: (
        event: RequestEventService,
      ) => AsyncIterable<Input> | Iterable<Input>;
      dynamic?: boolean;
    },
  ) => EffectPrerenderFunction<Input, Output, ErrorType>)
  & (<SchemaType extends EffectSchema, Output, ErrorType, Requirements>(
    validate: SchemaType,
    fn: (
      arg: SchemaOutput<SchemaType>,
    ) => Effect.Effect<Output, ErrorType, Requirements>,
    options?: {
      inputs?: (
        event: RequestEventService,
      ) =>
        | AsyncIterable<SchemaInput<SchemaType>>
        | Iterable<SchemaInput<SchemaType>>;
      dynamic?: boolean;
    },
  ) => EffectPrerenderFunction<SchemaInput<SchemaType>, Output, ErrorType>);
```

The `prerender` function is similar to `query`, except that it will be invoked
at build time to prerender the result. Use this for data that changes at most
once per redeployment.

```ts
import { Effect } from "effect";
import { Prerender } from "svelte-effect-runtime";
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
```

## Prerender arguments

As with queries, prerender functions can accept an argument, which should be
validated with an Effect schema:

```ts
export const get_post_by_slug = Query(
  Effect.Struct({
    slug: Effect.String,
  }),
  Effect.gen(function* () {
    const db = yield* Database;

    const [post] = yield* db.sql`
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

Any calls to `get_post(...)` found by SvelteKit's crawler while prerendering
pages will be saved automatically, but you can also specify which values it
should be called with using the `inputs` option:

```ts
export const get_post = Prerender(
  Effect.Struct({
    slug: Effect.String,
  }),
  async (slug) => {/* ... */},
  {
    inputs: () => [
      "first-post",
      "second-post",
      "third-post",
    ],
  },
);
```
