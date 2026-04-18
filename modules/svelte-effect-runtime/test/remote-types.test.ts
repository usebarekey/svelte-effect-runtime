import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { FormError } from "../client.ts";
import { Form, Query, RequestEvent } from "../server.ts";

const Create_post = Schema.Struct({
  body: Schema.String,
  title: Schema.String,
});

Deno.test("remote type helpers compile", () => {
  const should_skip_runtime = typeof document !== "undefined";

  if (should_skip_runtime) {
    Form(Create_post, ({ data, invalid }) => {
      data.title satisfies string;
      invalid.title satisfies (
        message: string,
      ) => Effect.Effect<never, FormError<typeof Create_post>, never>;

      // @ts-expect-error - only top-level schema keys should be available
      invalid.slug;

      return Effect.succeed({
        ok: true as const,
      });
    });

    Query(() =>
      Effect.gen(function* () {
        const request_event = yield* RequestEvent;
        request_event.cookies.get("session_id");
        return "ok";
      })
    );

    // @ts-expect-error - non-Effect schema validators are unsupported
    Query({ parse: (value: unknown) => value }, () => Effect.succeed("nope"));
  }
});
