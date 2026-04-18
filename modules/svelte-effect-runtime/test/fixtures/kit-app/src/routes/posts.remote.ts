import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Command, Form, Prerender, Query, RequestEvent } from "ser/server";

const Post_slug = Schema.String;
const Create_post = Schema.Struct({
  body: Schema.String,
  title: Schema.String,
});

export const get_post = Query(Post_slug, (slug) =>
  Effect.gen(function* () {
    const request_event = yield* RequestEvent;

    return {
      session: request_event.cookies.get("session_id") ?? "missing",
      slug,
      title: `Post ${slug}`,
    };
  }));

export const get_posts = Query.batch(
  Post_slug,
  (slugs) =>
    Effect.succeed(slugs.map((slug, index) => ({
      index,
      slug,
      title: `Post ${slug}`,
      total: slugs.length,
    }))),
);

export const square_post = Command(Schema.Number, (value) =>
  Effect.succeed({
    value: value * value,
  }));

export const create_post = Form(
  Create_post,
  ({ data, invalid }) =>
    Effect.gen(function* () {
      if (data.title.length < 3) {
        yield* invalid.title("title too short");
      }

      if (data.body.length === 0) {
        yield* invalid.body("body is required");
      }

      return {
        slug: data.title.toLowerCase(),
      };
    }),
);

export const get_static_post = Prerender(
  Post_slug,
  (slug) =>
    Effect.succeed({
      slug,
      title: `Static ${slug}`,
    }),
  {
    dynamic: false,
    inputs: function* (_request_event) {
      yield "intro";
    },
  },
);
