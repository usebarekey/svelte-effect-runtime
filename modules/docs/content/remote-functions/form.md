# Form

```ts
import { Form } from "svelte-effect-runtime";
```

```ts
declare const Form:
  & (<Output, ErrorType, Requirements>(
    fn: () => Effect.Effect<Output, ErrorType, Requirements>,
  ) => EffectForm<void, Output, ErrorType>)
  & (<Input extends RemoteFormInput, Output, ErrorType, Requirements>(
    validate: "unchecked",
    fn: (args: {
      data: Input;
      invalid: Invalid;
    }) => Effect.Effect<Output, ErrorType | FormError, Requirements>,
  ) => EffectForm<Input, Output, ErrorType>)
  & (<SchemaType extends EffectSchema, Output, ErrorType, Requirements>(
    validate: SchemaType,
    fn: (args: {
      data: SchemaOutput<SchemaType>;
      invalid: Invalid<SchemaType>;
    }) => Effect.Effect<
      Output,
      ErrorType | FormError<SchemaType>,
      Requirements
    >,
  ) => EffectForm<
    SchemaInput<SchemaType> & RemoteFormInput,
    Output,
    ErrorType
  >);
```

The `Form` function is a wrapper over SvelteKit's `form`. The form function
makes it easy to write data to the server. It takes a callback that receives
`data` constructed from the submitted `FormData`...

::: code-group

```ts [src/routes/blog/data.remote.ts]
import { Effect, Schema } from "effect";
import { redirect } from "@sveltejs/kit";
import { Form } from "svelte-effect-runtime";
import { Database } from "$lib/server/database";
import { User } from "$lib/server/hooks/user";
import { NotSignedInError } from "$lib/common/errors";

export const create_post = Form(
  Schema.Struct({
    title: Schema.String,
    content: Schema.String,
  }),
  ({ data, invalid }) =>
    Effect.gen(function* () {
      const db = yield* Database;
      const user = yield* User;

      if (!data.title.trim()) {
        return yield* invalid.title("Please enter a title.");
      }

      if (!(yield* user.is_signed_in())) {
        return yield* Effect.fail(new NotSignedInError());
      }

      const slug = data.title.toLowerCase().replace(/ /g, "-");

      await db.sql`
        insert into posts (slug, title, content)
        values (${slug}, ${data.title}, ${data.content})
      `;

      redirect(303, `/blog/${slug}`);
    }),
);
```

```svelte [src/routes/blog/+page.svelte]
<script lang="ts" effect>
  import { create_post } from "./data.remote";
</script>

<h1>Create a Post</h1>


<form {...create_post}>
  <label>
		<h2>Title</h2>
		<input {...create_post.fields.title.as("text")} />
	</label>

  <label>
		<h2>Write your post</h2>
		<textarea {...create_post.fields.content.as("text")}></textarea>
	</label>

  <button>Publish!</button>
</form>
```

The callback receives an object with:

- `data`: the submitted form payload, already decoded into a plain object
- `invalid`: helpers for producing validation failures like
  `yield* invalid.title("Required")` or `yield* invalid.form("Try again")`

If you are using `.remote.ts` forms, make sure
`kit.experimental.remoteFunctions = true` is enabled in `svelte.config.js`.

:::
