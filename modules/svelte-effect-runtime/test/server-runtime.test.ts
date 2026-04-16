import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "@std/assert";
import { toFileUrl } from "@std/path";
import * as Effect from "effect/Effect";
import { repoFile } from "./helpers.ts";

Deno.test("get_server_runtime_or_throw lazily creates and caches a default runtime", async () => {
  const server_module_url = `${
    toFileUrl(repoFile("server.ts")).href
  }?case=lazy_server_runtime`;
  const server_module = await import(
    server_module_url
  ) as typeof import("../server.ts");

  const default_runtime = server_module.get_server_runtime_or_throw();

  assertEquals(await default_runtime.runPromise(Effect.succeed("ok")), "ok");
  assertStrictEquals(
    server_module.get_server_runtime_or_throw(),
    default_runtime,
  );

  server_module.ServerRuntime.make();

  const replacement_runtime = server_module.get_server_runtime_or_throw();

  assertNotStrictEquals(replacement_runtime, default_runtime);

  await replacement_runtime.dispose();
});
