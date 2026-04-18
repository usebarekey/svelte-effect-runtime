import {
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
} from "@std/assert";
import * as Effect from "effect/Effect";
import type { VersionHarness } from "$tests/shared/versions.ts";

export function register_server_runtime_behaviors(
  harness: VersionHarness,
): void {
  const { label, serverModuleUrl } = harness;

  Deno.test(
    `[${label}] get_server_runtime_or_throw lazily creates and caches a default runtime`,
    async () => {
      const server_module = await import(
        `${serverModuleUrl}?case=lazy_server_runtime_${label}`
      ) as typeof import("$/v3/server.ts");

      const default_runtime = server_module.get_server_runtime_or_throw();

      assertEquals(
        await default_runtime.runPromise(Effect.succeed("ok")),
        "ok",
      );
      assertStrictEquals(
        server_module.get_server_runtime_or_throw(),
        default_runtime,
      );

      server_module.ServerRuntime.make();

      const replacement_runtime = server_module.get_server_runtime_or_throw();

      assertNotStrictEquals(replacement_runtime, default_runtime);

      await replacement_runtime.dispose();
    },
  );

  Deno.test(
    `[${label}] missing request-store crashes are remapped to remoteFunctions setup guidance`,
    async () => {
      const server_module = await import(
        `${serverModuleUrl}?case=missing_request_store_${label}`
      ) as typeof import("$/v3/server.ts");

      const normalized = server_module.normalize_remote_helper_error(
        new Error(
          'Could not get the request store. In environments without "AsyncLocalStorage"...',
        ),
      );

      assertEquals(normalized instanceof Error, true);
      if (!(normalized instanceof Error)) {
        throw new Error("Expected a normalized Error instance.");
      }

      assertEquals(
        normalized.message.includes("kit.experimental.remoteFunctions = true"),
        true,
      );
      assertEquals(
        normalized.message.includes("Enable that flag and restart Vite."),
        true,
      );
    },
  );

  Deno.test(
    `[${label}] unrelated server errors are preserved when normalization is not needed`,
    async () => {
      const server_module = await import(
        `${serverModuleUrl}?case=passthrough_request_store_${label}`
      ) as typeof import("$/v3/server.ts");

      const original_error = new Error("something else went wrong");
      const normalized = server_module.normalize_remote_helper_error(
        original_error,
      );

      assertStrictEquals(normalized, original_error);
    },
  );
}
