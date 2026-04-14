import {
  type Options as SveltePluginOptions,
  svelte,
} from "@sveltejs/vite-plugin-svelte";
import type { Plugin } from "vite";
import {
  effectPreprocess,
  type EffectPreprocessOptions,
} from "./preprocess.ts";

export interface SvelteEffectRuntimeOptions {
  effect?: EffectPreprocessOptions;
  svelte?: SveltePluginOptions;
}

export interface SveltekitEffectRuntimeOptions {
  /**
   * Override the client-side module SvelteKit uses for generated `.remote.ts`
   * imports so remote calls default to Effect-returning adapters.
   */
  remoteModuleId?: string;
}

const ROOT_PACKAGE_ID = "@barekey/svelte-effect-runtime";
const INTERNAL_SERVER_PACKAGE_ID = "@barekey/svelte-effect-runtime/_server";
const SERVER_SOURCE_PATTERN =
  /(?:^|\/)(?:hooks\.server\.[cm]?[jt]s|.+\.server\.[cm]?[jt]s|.+\.remote\.[cm]?[jt]s)$/;

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function svelteEffectRuntime(
  options: SvelteEffectRuntimeOptions = {},
): Plugin[] {
  const existingPreprocessors = arrayify(options.svelte?.preprocess);

  return svelte({
    ...options.svelte,
    preprocess: [
      effectPreprocess(options.effect),
      ...existingPreprocessors,
    ],
  });
}

function resolve_runtime_internal_path(
  source_relative_path: string,
  dist_relative_path: string,
): string {
  const relative_path = import.meta.url.endsWith(".ts")
    ? source_relative_path
    : dist_relative_path;

  return new URL(relative_path, import.meta.url).pathname;
}

function create_remote_runtime_module_code(): string {
  const adapter_module_path = resolve_runtime_internal_path(
    "./internal/remote-client.ts",
    "./internal/remote-client.js",
  );
  const kit_query_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/query.svelte.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/query.svelte.js",
  );
  const kit_command_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/command.svelte.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/command.svelte.js",
  );
  const kit_form_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/form.svelte.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/form.svelte.js",
  );
  const kit_prerender_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/prerender.svelte.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/prerender.svelte.js",
  );
  const kit_shared_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/shared.svelte.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/client/remote-functions/shared.svelte.js",
  );
  const kit_client_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/client/client.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/client/client.js",
  );
  const kit_form_utils_module_path = resolve_runtime_internal_path(
    "../../node_modules/@sveltejs/kit/src/runtime/form-utils.js",
    "../../../node_modules/@sveltejs/kit/src/runtime/form-utils.js",
  );

  return `
import * as devalue from "devalue";
import { base, app_dir } from "$app/paths/internal/client";
import { query as native_query, query_batch as native_query_batch } from ${JSON.stringify(kit_query_module_path)};
import { command as native_command } from ${JSON.stringify(kit_command_module_path)};
import { form as native_form } from ${JSON.stringify(kit_form_module_path)};
import { prerender as native_prerender } from ${JSON.stringify(kit_prerender_module_path)};
import {
  apply_refreshes,
  get_remote_request_headers,
  remote_request
} from ${JSON.stringify(kit_shared_module_path)};
import { app, invalidateAll, _goto } from ${JSON.stringify(kit_client_module_path)};
import { BINARY_FORM_CONTENT_TYPE, serialize_binary_form } from ${JSON.stringify(kit_form_utils_module_path)};
import { stringify_remote_arg } from ${JSON.stringify(resolve_runtime_internal_path(
   "../../node_modules/@sveltejs/kit/src/runtime/shared.js",
   "../../../node_modules/@sveltejs/kit/src/runtime/shared.js",
 ))};
import {
  create_remote_command_adapter,
  create_remote_form_adapter,
  create_remote_query_adapter
} from ${JSON.stringify(adapter_module_path)};

const decode_payload = (encoded) => devalue.parse(encoded, app?.decoders ?? {});
const request_dependencies = {
  app,
  app_dir,
  apply_refreshes,
  base,
  get_remote_request_headers,
  remote_request,
  stringify_remote_arg
};

export const query = create_remote_query_adapter(native_query, decode_payload, request_dependencies, "query");
export const query_batch = create_remote_query_adapter(native_query_batch, decode_payload, request_dependencies, "query_batch");
export const command = create_remote_command_adapter(native_command, decode_payload, request_dependencies);
export const prerender = create_remote_query_adapter(native_prerender, decode_payload, request_dependencies, "prerender");
export const form = create_remote_form_adapter(native_form, decode_payload, {
  binary_form_content_type: BINARY_FORM_CONTENT_TYPE,
  goto: _goto,
  invalidate_all: invalidateAll,
  serialize_binary_form,
  ...request_dependencies
});
`;
}

export function sveltekitEffectRuntime(
  options: SveltekitEffectRuntimeOptions = {},
): Plugin {
  const remote_module_id = options.remoteModuleId ?? "\0svelte-effect-runtime:remote";

  return {
    name: "svelte-effect-runtime-remote",
    enforce: "pre",
    resolveId(id) {
      if (id === "__sveltekit/remote") {
        return remote_module_id;
      }
    },
    load(id) {
      if (id !== remote_module_id) {
        return;
      }

      return create_remote_runtime_module_code();
    },
    transform(code, id) {
      const filename = id.split("?", 1)[0];
      if (!SERVER_SOURCE_PATTERN.test(filename)) {
        return null;
      }

      if (!code.includes(ROOT_PACKAGE_ID)) {
        return null;
      }

      return code.replaceAll(ROOT_PACKAGE_ID, INTERNAL_SERVER_PACKAGE_ID);
    },
  };
}
