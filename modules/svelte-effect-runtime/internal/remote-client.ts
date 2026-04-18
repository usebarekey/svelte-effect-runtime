import * as Effect from "effect/Effect";
import { tick } from "svelte";
import { create_remote_effect_from_promise } from "$/client.ts";
import { create_async_effect } from "$internal/effect-compat.ts";
import {
  create_remote_domain_error,
  create_remote_http_error,
  create_remote_transport_error,
  create_remote_validation_error,
  type FormIssue,
  is_remote_validation_issue,
  is_serialized_remote_failure_envelope,
  REMOTE_ERROR_DECODER,
  type RemoteFailure,
} from "$internal/remote-shared.ts";

type AnyCallable = (...args: Array<unknown>) => unknown;

type Decode_remote_payload = <ErrorType = unknown>(
  encoded: string,
) => ErrorType;

interface HttpErrorLike {
  readonly body?: unknown;
  readonly status?: number;
}

interface RedirectLike {
  readonly location: string;
  readonly status: number;
}

interface Remote_request_dependencies {
  readonly app?: {
    readonly decoders?: Record<string, unknown>;
    readonly hooks?: {
      readonly transport?: Record<string, unknown>;
    };
  };
  readonly app_dir: string;
  readonly apply_refreshes?: (value: string) => void;
  readonly base: string;
  readonly get_remote_request_headers: () => HeadersInit;
  readonly remote_request: (
    url: string,
    headers: HeadersInit,
  ) => Promise<string>;
  readonly stringify_remote_arg: (
    value: unknown,
    transport: unknown,
    sort?: boolean,
  ) => string;
}

type Query_adapter_mode = "query" | "query_batch" | "prerender";

type Form_request_dependencies = Remote_request_dependencies & {
  readonly app: {
    readonly decoders?: Record<string, unknown>;
    readonly encoders?: Record<string, unknown>;
  };
  readonly app_dir: string;
  readonly apply_refreshes: (value: string) => void;
  readonly base: string;
  readonly binary_form_content_type: string;
  readonly goto: (url: string, options?: unknown, code?: number) => void;
  readonly invalidate_all: () => Promise<void> | void;
  readonly serialize_binary_form: (
    data: unknown,
    meta: Record<string, unknown>,
  ) => {
    readonly blob: Blob;
  };
};

interface Attached_form_tracker {
  current: HTMLFormElement | null;
}

function is_development_environment(): boolean {
  const vite_environment = (
    import.meta as ImportMeta & {
      env?: {
        DEV?: boolean;
      };
    }
  ).env;

  if (typeof vite_environment?.DEV === "boolean") {
    return vite_environment.DEV;
  }

  const node_process = (globalThis as typeof globalThis & {
    process?: {
      env?: {
        DEV?: string;
        NODE_ENV?: string;
        SVELTE_EFFECT_RUNTIME_DEBUG?: string;
      };
    };
  }).process;

  return (
    node_process?.env?.SVELTE_EFFECT_RUNTIME_DEBUG === "1" ||
    node_process?.env?.DEV === "1" ||
    node_process?.env?.NODE_ENV === "development"
  );
}

const ENABLE_REMOTE_CLIENT_DEBUG_LOGS = is_development_environment();

function log_remote_client_step(
  step: string,
  details?: Record<string, unknown>,
): void {
  if (!ENABLE_REMOTE_CLIENT_DEBUG_LOGS) {
    return;
  }

  console.log("[svelte-effect-runtime][remote-client]", step, details ?? {});
}

function define_hidden_property<Value extends object, Property>(
  value: Value,
  key: string | symbol,
  property: Property,
): Value {
  Object.defineProperty(value, key, {
    value: property,
    enumerable: false,
  });

  return value;
}

function define_remote_error_decoder<Value extends object>(
  value: Value,
  decode_payload: Decode_remote_payload,
): Value {
  return define_hidden_property(value, REMOTE_ERROR_DECODER, decode_payload);
}

function is_http_error_like(value: unknown): value is HttpErrorLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { status?: unknown }).status === "number",
  );
}

function is_redirect_like(value: unknown): value is RedirectLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { location?: unknown }).location === "string" &&
      typeof (value as { status?: unknown }).status === "number",
  );
}

function get_error_status(value: unknown): number {
  return is_http_error_like(value) ? value.status ?? 500 : 500;
}

function decode_remote_error<ErrorType>(
  error: unknown,
  decode_payload: Decode_remote_payload,
): RemoteFailure<ErrorType> {
  log_remote_client_step("decode_remote_error:start", {
    error,
  });

  if (is_http_error_like(error)) {
    const body = error.body;

    if (is_serialized_remote_failure_envelope(body)) {
      try {
        return create_remote_domain_error<ErrorType>(
          decode_payload<ErrorType>(body.encoded),
          get_error_status(error),
        );
      } catch (cause) {
        return create_remote_transport_error(cause, body);
      }
    }

    if (get_error_status(error) === 400) {
      return create_remote_validation_error([], {
        body,
        status: 400,
      });
    }

    return create_remote_http_error(error, {
      body,
      status: get_error_status(error),
    });
  }

  const decoded = create_remote_http_error(error);
  log_remote_client_step("decode_remote_error:http_error", {
    decoded,
  });
  return decoded;
}

function create_effect_call<Success, ErrorType>(
  create_promise: () => PromiseLike<Success>,
  decode_payload: Decode_remote_payload,
): Effect.Effect<Success, RemoteFailure<ErrorType>, never> {
  return create_remote_effect_from_promise<Success, ErrorType>(
    () => {
      log_remote_client_step("create_effect_call:start");
      return create_promise();
    },
    (error) => decode_remote_error<ErrorType>(error, decode_payload),
  );
}

function create_decoded_native_callable(
  native: AnyCallable,
  decode_payload: Decode_remote_payload,
): AnyCallable {
  const wrapped = ((...args: Array<unknown>) => {
    const result = native(...args);

    if (
      result && (typeof result === "object" || typeof result === "function")
    ) {
      define_remote_error_decoder(result as object, decode_payload);
    }

    return result;
  }) as AnyCallable;

  define_hidden_property(wrapped, "native", native);
  define_remote_error_decoder(wrapped as object, decode_payload);

  return wrapped;
}

function get_transport(
  dependencies?: Remote_request_dependencies,
): Record<string, unknown> {
  return dependencies?.app?.hooks?.transport ?? {};
}

function stringify_remote_payload(
  arg: unknown,
  dependencies: Remote_request_dependencies,
  sort = true,
): string {
  if (arg === undefined) {
    return "";
  }

  return dependencies.stringify_remote_arg(
    arg,
    get_transport(dependencies),
    sort,
  );
}

async function execute_query_request<Success>(
  id: string,
  arg: unknown,
  decode_payload: Decode_remote_payload,
  dependencies: Remote_request_dependencies,
): Promise<Success> {
  const payload = stringify_remote_payload(arg, dependencies);
  const url = `${dependencies.base}/${dependencies.app_dir}/remote/${id}${
    payload ? `?payload=${payload}` : ""
  }`;
  const encoded = await dependencies.remote_request(
    url,
    dependencies.get_remote_request_headers(),
  );

  return decode_payload<Success>(encoded);
}

async function execute_query_batch_request<Success>(
  id: string,
  arg: unknown,
  decode_payload: Decode_remote_payload,
  dependencies: Remote_request_dependencies,
): Promise<Success> {
  const payload = stringify_remote_payload(arg, dependencies);
  const response = await fetch(
    `${dependencies.base}/${dependencies.app_dir}/remote/${id}`,
    {
      method: "POST",
      body: JSON.stringify({
        payloads: [payload],
      }),
      headers: {
        "Content-Type": "application/json",
        ...dependencies.get_remote_request_headers(),
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to execute batch query");
  }

  const result = await response.json() as {
    readonly type: string;
    readonly result?: string;
    readonly status?: number;
    readonly error?: unknown;
    readonly location?: string;
  };

  if (result.type === "error") {
    throw {
      body: result.error,
      status: result.status ?? 500,
    };
  }

  if (result.type === "redirect") {
    throw {
      location: result.location,
      status: 307,
    };
  }

  const entries = decode_payload<
    Array<{
      readonly data?: Success;
      readonly error?: unknown;
      readonly status?: number;
      readonly type: string;
    }>
  >(result.result ?? "");
  const first = entries[0];

  if (!first) {
    throw new Error("Batch query returned no entries.");
  }

  if (first.type === "error") {
    throw {
      body: first.error,
      status: first.status ?? 500,
    };
  }

  return first.data as Success;
}

async function execute_prerender_request<Success>(
  id: string,
  arg: unknown,
  decode_payload: Decode_remote_payload,
  dependencies: Remote_request_dependencies,
): Promise<Success> {
  const payload = stringify_remote_payload(arg, dependencies);
  const url = `${dependencies.base}/${dependencies.app_dir}/remote/${id}${
    payload ? `/${payload}` : ""
  }`;
  const encoded = await dependencies.remote_request(
    url,
    dependencies.get_remote_request_headers(),
  );

  return decode_payload<Success>(encoded);
}

function create_query_request<Success>(
  mode: Query_adapter_mode,
  id: string,
  arg: unknown,
  decode_payload: Decode_remote_payload,
  dependencies?: Remote_request_dependencies,
  native_with_decoder?: AnyCallable,
): Promise<Success> {
  if (!dependencies || !native_with_decoder) {
    return Promise.resolve(native_with_decoder?.(arg) as Success);
  }

  switch (mode) {
    case "query":
      return execute_query_request<Success>(
        id,
        arg,
        decode_payload,
        dependencies,
      );
    case "query_batch":
      return execute_query_batch_request<Success>(
        id,
        arg,
        decode_payload,
        dependencies,
      );
    case "prerender":
      return execute_prerender_request<Success>(
        id,
        arg,
        decode_payload,
        dependencies,
      );
  }
}

async function execute_command_request<Success>(
  id: string,
  arg: unknown,
  decode_payload: Decode_remote_payload,
  dependencies: Remote_request_dependencies,
): Promise<Success> {
  const response = await fetch(
    `${dependencies.base}/${dependencies.app_dir}/remote/${id}`,
    {
      method: "POST",
      body: JSON.stringify({
        payload: stringify_remote_payload(arg, dependencies, false),
        refreshes: [],
      }),
      headers: {
        "Content-Type": "application/json",
        ...dependencies.get_remote_request_headers(),
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to execute remote command");
  }

  const result = await response.json() as {
    readonly type: string;
    readonly result?: string;
    readonly status?: number;
    readonly error?: unknown;
    readonly refreshes?: string;
  };

  if (result.type === "error") {
    throw {
      body: result.error,
      status: result.status ?? 500,
    };
  }

  if (result.type === "redirect") {
    throw new Error(
      "Redirects are not allowed in commands. Return a result instead and use goto on the client.",
    );
  }

  if (result.refreshes) {
    dependencies.apply_refreshes?.(result.refreshes);
  }

  return decode_payload<Success>(result.result ?? "");
}

export function create_remote_query_adapter(
  native_query_factory: (id: string) => AnyCallable,
  decode_payload: Decode_remote_payload,
  dependencies?: Remote_request_dependencies,
  mode: Query_adapter_mode = "query",
) {
  return (id: string) => {
    const native = native_query_factory(id);
    const native_with_decoder = create_decoded_native_callable(
      native,
      decode_payload,
    );
    const wrapped = ((arg?: unknown) =>
      create_effect_call(
        () =>
          create_query_request(
            mode,
            id,
            arg,
            decode_payload,
            dependencies,
            native_with_decoder,
          ),
        decode_payload,
      )) as AnyCallable;

    define_hidden_property(wrapped, "native", native_with_decoder);

    return wrapped;
  };
}

export function create_remote_command_adapter(
  native_command_factory: (id: string) => AnyCallable,
  decode_payload: Decode_remote_payload,
  dependencies?: Remote_request_dependencies,
) {
  return (id: string) => {
    const native = native_command_factory(id);
    const native_with_decoder = create_decoded_native_callable(
      native,
      decode_payload,
    );
    let local_pending = 0;
    const wrapped = ((arg?: unknown) =>
      create_effect_call(
        async () => {
          local_pending += 1;

          try {
            if (!dependencies) {
              return await Promise.resolve(native_with_decoder(arg));
            }

            return await execute_command_request(
              id,
              arg,
              decode_payload,
              dependencies,
            );
          } finally {
            local_pending -= 1;
          }
        },
        decode_payload,
      )) as AnyCallable;

    define_hidden_property(wrapped, "native", native_with_decoder);
    Object.defineProperty(wrapped, "pending", {
      get: () =>
        ((native as { pending?: number }).pending ?? 0) + local_pending,
    });

    return wrapped;
  };
}

function normalize_form_issues(issues: unknown): ReadonlyArray<FormIssue> {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.flatMap((issue) =>
    is_remote_validation_issue(issue)
      ? [{
        message: issue.message,
        path: [...issue.path],
      }]
      : []
  );
}

function get_root_form_issues(
  native: {
    readonly fields?: {
      readonly allIssues?: unknown;
    };
  },
): ReadonlyArray<FormIssue> {
  return normalize_form_issues(native.fields?.allIssues);
}

function get_attachment(
  value: Record<string | symbol, unknown>,
): (form: HTMLFormElement) => void | (() => void) {
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    const candidate = value[symbol];

    if (typeof candidate === "function") {
      return candidate as (form: HTMLFormElement) => void | (() => void);
    }
  }

  throw new Error(
    "Failed to find the Svelte attachment for the remote form enhancement.",
  );
}

function build_form_field_name(path: ReadonlyArray<string | number>): string {
  let name = "";

  for (const segment of path) {
    if (typeof segment === "number") {
      name += `[${segment}]`;
      continue;
    }

    name += name === "" ? segment : `.${segment}`;
  }

  return name;
}

function append_hidden_input(
  form: HTMLFormElement,
  name: string,
  value: string,
): void {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  form.append(input);
}

function append_file_input(
  form: HTMLFormElement,
  name: string,
  value: File,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.name = name;

  if (typeof DataTransfer === "function") {
    const transfer = new DataTransfer();
    transfer.items.add(value);

    try {
      input.files = transfer.files;
    } catch {
      // ignore and fall back below
    }
  }

  if (input.files?.length) {
    form.append(input);
    return;
  }

  append_hidden_input(form, name, value.name);
}

function append_form_value(
  form: HTMLFormElement,
  value: unknown,
  path: ReadonlyArray<string | number>,
): void {
  if (value === undefined) {
    return;
  }

  if (value instanceof File) {
    append_file_input(form, build_form_field_name(path), value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      append_form_value(form, entry, [...path, index]);
    });
    return;
  }

  if (value && typeof value === "object") {
    for (
      const [key, entry] of Object.entries(value as Record<string, unknown>)
    ) {
      append_form_value(form, entry, [...path, key]);
    }
    return;
  }

  const base_name = build_form_field_name(path);

  if (typeof value === "number") {
    append_hidden_input(form, `n:${base_name}`, String(value));
    return;
  }

  if (typeof value === "boolean") {
    append_hidden_input(form, `b:${base_name}`, value ? "on" : "");
    return;
  }

  append_hidden_input(
    form,
    base_name,
    value === null ? "" : String(value),
  );
}

function apply_input_to_fields(fields: unknown, input: unknown): void {
  if (!fields || typeof fields !== "object") {
    return;
  }

  const maybe_field = fields as {
    readonly set?: (value: unknown) => void;
  };

  if (typeof maybe_field.set === "function") {
    maybe_field.set(input);
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    apply_input_to_fields(
      (fields as Record<string, unknown>)[key],
      value,
    );
  }
}

type Submitter_like = {
  click(): void;
} & Record<string, unknown>;

function is_submitter_like(value: unknown): value is Submitter_like {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { click?: unknown }).click === "function",
  );
}

function get_submitter(
  form: HTMLFormElement,
): Submitter_like | undefined {
  const submitter = form.querySelector("button:not([type]), [type='submit']");
  return is_submitter_like(submitter) ? submitter : undefined;
}

function request_form_submit(form: HTMLFormElement): void {
  const submitter = get_submitter(form);
  log_remote_client_step("request_form_submit", {
    action: form.action,
    has_submitter: Boolean(submitter),
    submitter,
  });

  if (typeof SubmitEvent === "function") {
    form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
        submitter: submitter as HTMLElement | null | undefined,
      }),
    );
    return;
  }

  const event = new Event("submit", {
    bubbles: true,
    cancelable: true,
  }) as Event & {
    readonly submitter?: Submitter_like;
  };
  Object.defineProperty(event, "submitter", {
    configurable: true,
    value: submitter,
  });
  form.dispatchEvent(event);
}

async function wait_for_pending_settle(
  native: {
    readonly pending?: number;
  },
): Promise<void> {
  await tick();

  while ((native.pending ?? 0) > 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  await tick();
}

async function submit_attached_form<Success, ErrorType>(
  form: {
    readonly native: {
      readonly fields?: {
        readonly allIssues?: unknown;
      } & Record<string, unknown>;
      readonly pending?: number;
      readonly result?: Success;
    };
  },
  element: HTMLFormElement,
  input: unknown,
): Promise<Effect.Effect<Success, RemoteFailure<ErrorType>, never>> {
  log_remote_client_step("submit_attached_form:start", {
    action: element.action,
    input,
  });

  if (input !== undefined) {
    apply_input_to_fields(form.native.fields, input);
  }

  await tick();
  request_form_submit(element);
  await wait_for_pending_settle(form.native);

  const issues = get_root_form_issues(form.native);
  log_remote_client_step("submit_attached_form:after_submit", {
    issues,
    pending: form.native.pending ?? 0,
    result: form.native.result,
  });

  if (issues.length > 0) {
    return Effect.fail(
      create_remote_validation_error(issues, {
        body: issues,
        status: 400,
      }),
    );
  }

  return Effect.succeed(form.native.result as Success);
}

function create_form_submit_effect<Success, ErrorType>(
  form: {
    readonly native: {
      readonly action: string;
      readonly result?: Success;
      readonly fields?: {
        readonly allIssues?: unknown;
      };
      enhance(
        callback: (args: {
          readonly form: HTMLFormElement;
          readonly data: unknown;
          readonly submit: () => Promise<unknown>;
        }) => Promise<void> | void,
      ): Record<string | symbol, unknown>;
    };
  },
  input: unknown,
  decode_payload: Decode_remote_payload,
  attached_form_tracker: Attached_form_tracker,
  _dependencies: Form_request_dependencies,
): Effect.Effect<Success, RemoteFailure<ErrorType>, never> {
  return create_async_effect<Success, RemoteFailure<ErrorType>>((resume) => {
    log_remote_client_step("create_form_submit_effect:start", {
      action: form.native.action,
      input,
      attached: Boolean(attached_form_tracker.current),
    });

    if (typeof document === "undefined") {
      resume(
        Effect.fail(
          create_remote_http_error(
            new Error("Programmatic remote form submission requires a DOM."),
          ),
        ),
      );
      return;
    }

    let settled = false;
    let dispose_attachment: void | (() => void);
    const temp_form = document.createElement("form");
    temp_form.method = "POST";
    temp_form.action = form.native.action;
    temp_form.hidden = true;
    document.body.append(temp_form);

    const cleanup = () => {
      if (typeof dispose_attachment === "function") {
        dispose_attachment();
      }

      temp_form.remove();
    };

    const finish = (
      effect: Effect.Effect<Success, RemoteFailure<ErrorType>, never>,
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resume(effect);
    };

    try {
      const attached_form = attached_form_tracker.current;

      if (attached_form) {
        log_remote_client_step(
          "create_form_submit_effect:attached_form_branch",
          {
            action: attached_form.action,
          },
        );
        void submit_attached_form<Success, ErrorType>(
          form,
          attached_form,
          input,
        ).then(finish, (error) => {
          finish(
            Effect.fail(decode_remote_error<ErrorType>(error, decode_payload)),
          );
        });
        return;
      }

      log_remote_client_step(
        "create_form_submit_effect:detached_fallback_branch",
        {
          action: form.native.action,
        },
      );
      const enhanced = form.native.enhance(async ({ submit }) => {
        try {
          log_remote_client_step(
            "create_form_submit_effect:fallback_submit:start",
            {
              action: form.native.action,
            },
          );
          await submit();
          const issues = get_root_form_issues(form.native);
          log_remote_client_step(
            "create_form_submit_effect:fallback_submit:after",
            {
              issues,
              result: form.native.result,
            },
          );

          if (issues.length > 0) {
            finish(
              Effect.fail(
                create_remote_validation_error(issues, {
                  body: issues,
                  status: 400,
                }),
              ),
            );
            return;
          }

          finish(Effect.succeed(form.native.result as Success));
        } catch (error) {
          if (is_redirect_like(error)) {
            finish(Effect.die(error));
            return;
          }

          finish(
            Effect.fail(decode_remote_error<ErrorType>(error, decode_payload)),
          );
        }
      });

      dispose_attachment = get_attachment(enhanced)(temp_form);

      if (input && typeof input === "object") {
        append_form_value(temp_form, input, []);
      }

      const submitter = document.createElement("button");
      submitter.type = "submit";
      temp_form.append(submitter);
      if (typeof temp_form.requestSubmit === "function") {
        temp_form.requestSubmit(submitter);
      } else {
        submitter.click();
      }
    } catch (error) {
      log_remote_client_step("create_form_submit_effect:error", {
        error,
      });
      finish(
        Effect.fail(decode_remote_error<ErrorType>(error, decode_payload)),
      );
    }
  });
}

function wrap_native_form(
  native: Record<string, unknown>,
  decode_payload: Decode_remote_payload,
  dependencies: Form_request_dependencies,
) {
  const attached_form_tracker: Attached_form_tracker = {
    current: null,
  };
  const wrapped_symbol_properties = new Map<symbol, unknown>();
  const proxy_target: Record<string, unknown> = {};
  Object.defineProperty(proxy_target, "native", {
    configurable: true,
    enumerable: false,
    value: native,
    writable: false,
  });
  const wrapped = new Proxy(proxy_target, {
    get(_target, property, receiver) {
      if (property === "native") {
        return native;
      }

      if (property === "submit") {
        return (input: unknown) =>
          create_form_submit_effect(
            receiver as {
              readonly native: {
                readonly action: string;
                readonly result?: unknown;
                readonly fields?: {
                  readonly allIssues?: unknown;
                };
                enhance(
                  callback: (args: {
                    readonly form: HTMLFormElement;
                    readonly data: unknown;
                    readonly submit: () => Promise<unknown>;
                  }) => Promise<void> | void,
                ): Record<string | symbol, unknown>;
              };
            },
            input,
            decode_payload,
            attached_form_tracker,
            dependencies,
          );
      }

      if (typeof property === "symbol") {
        if (wrapped_symbol_properties.has(property)) {
          return wrapped_symbol_properties.get(property);
        }

        const native_value = Reflect.get(native, property, native);

        if (typeof native_value === "function") {
          const wrapped_attachment = (element: HTMLFormElement) => {
            log_remote_client_step("wrap_native_form:attach", {
              action: element.action,
              native_action: (native as { action?: unknown }).action,
            });
            attached_form_tracker.current = element;
            const cleanup = native_value.call(native, element);

            return () => {
              log_remote_client_step("wrap_native_form:detach", {
                action: element.action,
              });
              if (attached_form_tracker.current === element) {
                attached_form_tracker.current = null;
              }

              if (typeof cleanup === "function") {
                cleanup();
              }
            };
          };

          wrapped_symbol_properties.set(property, wrapped_attachment);
          return wrapped_attachment;
        }
      }

      if (property === "for") {
        const native_for = Reflect.get(native, property, native);

        if (typeof native_for === "function") {
          return (key: string | number) =>
            wrap_native_form(
              native_for.call(native, key) as Record<string, unknown>,
              decode_payload,
              dependencies,
            );
        }
      }

      return Reflect.get(native, property, native);
    },
    has(_target, property) {
      if (
        property === "native" ||
        property === "submit" ||
        property === "for"
      ) {
        return true;
      }

      return Reflect.has(native, property);
    },
    ownKeys() {
      return Array.from(
        new Set([
          ...Reflect.ownKeys(native),
          "native",
          "submit",
          "for",
          ...wrapped_symbol_properties.keys(),
        ]),
      );
    },
    getOwnPropertyDescriptor(
      _target,
      property,
    ): PropertyDescriptor | undefined {
      if (property === "native") {
        return Reflect.getOwnPropertyDescriptor(proxy_target, property);
      }

      if (property === "submit" || property === "for") {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }

      const descriptor = Reflect.getOwnPropertyDescriptor(native, property);

      if (!descriptor) {
        return descriptor;
      }

      return {
        ...descriptor,
        configurable: true,
      };
    },
  });

  return wrapped as Record<string, unknown>;
}

export function create_remote_form_adapter(
  native_form_factory: (id: string) => Record<string, unknown>,
  decode_payload: Decode_remote_payload,
  dependencies: Form_request_dependencies,
) {
  return (id: string) => {
    const native = native_form_factory(id);
    return wrap_native_form(native, decode_payload, dependencies);
  };
}
