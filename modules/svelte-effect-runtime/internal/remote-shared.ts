export const EFFECT_REMOTE_ERROR_MARKER = "__svelte_effect_remote__";
export const REMOTE_ERROR_DECODER = Symbol.for(
  "svelte-effect-runtime/remote-error-decoder",
);

export interface FormIssue {
  readonly message: string;
  readonly path: ReadonlyArray<string | number>;
}

export interface FormError<SchemaType = unknown> {
  readonly _tag: "FormError";
  readonly issues: ReadonlyArray<FormIssue>;
  readonly _schema?: SchemaType | undefined;
}

export interface RemoteDomainError<ErrorType = unknown> {
  readonly _tag: "RemoteDomainError";
  readonly cause: ErrorType;
  readonly status: number;
}

export interface RemoteValidationError {
  readonly _tag: "RemoteValidationError";
  readonly body?: unknown;
  readonly issues: ReadonlyArray<FormIssue>;
  readonly status: number;
}

export interface RemoteHttpError {
  readonly _tag: "RemoteHttpError";
  readonly body?: unknown;
  readonly cause: unknown;
  readonly status: number;
}

export interface RemoteTransportError {
  readonly _tag: "RemoteTransportError";
  readonly body?: unknown;
  readonly cause: unknown;
}

export type RemoteFailure<ErrorType = unknown> =
  | RemoteDomainError<ErrorType>
  | RemoteValidationError
  | RemoteHttpError
  | RemoteTransportError;

export interface SerializedRemoteFailureEnvelope {
  readonly [EFFECT_REMOTE_ERROR_MARKER]: true;
  readonly encoded: string;
}

export function create_form_error<SchemaType = unknown>(
  ...issues: Array<FormIssue>
): FormError<SchemaType> {
  return {
    _tag: "FormError",
    issues,
  };
}

export function create_remote_domain_error<ErrorType = unknown>(
  cause: ErrorType,
  status: number,
): RemoteDomainError<ErrorType> {
  return {
    _tag: "RemoteDomainError",
    cause,
    status,
  };
}

export function create_remote_validation_error(
  issues: ReadonlyArray<FormIssue>,
  options: {
    body?: unknown;
    status?: number;
  } = {},
): RemoteValidationError {
  return {
    _tag: "RemoteValidationError",
    body: options.body,
    issues,
    status: options.status ?? 400,
  };
}

export function create_remote_http_error(
  cause: unknown,
  options: {
    body?: unknown;
    status?: number;
  } = {},
): RemoteHttpError {
  return {
    _tag: "RemoteHttpError",
    body: options.body,
    cause,
    status: options.status ?? 500,
  };
}

export function create_remote_transport_error(
  cause: unknown,
  body?: unknown,
): RemoteTransportError {
  return {
    _tag: "RemoteTransportError",
    body,
    cause,
  };
}

export function create_serialized_remote_failure_envelope(
  encoded: string,
): SerializedRemoteFailureEnvelope {
  return {
    [EFFECT_REMOTE_ERROR_MARKER]: true,
    encoded,
  };
}

export function is_form_error(value: unknown): value is FormError {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { _tag?: unknown })._tag === "FormError" &&
      Array.isArray((value as { issues?: unknown }).issues),
  );
}

export function is_serialized_remote_failure_envelope(
  value: unknown,
): value is SerializedRemoteFailureEnvelope {
  return Boolean(
    value &&
      typeof value === "object" &&
      EFFECT_REMOTE_ERROR_MARKER in value &&
      (value as Record<string, unknown>)[EFFECT_REMOTE_ERROR_MARKER] === true &&
      typeof (value as { encoded?: unknown }).encoded === "string",
  );
}

export function is_remote_validation_issue(
  value: unknown,
): value is FormIssue {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { message?: unknown }).message === "string" &&
      Array.isArray((value as { path?: unknown }).path),
  );
}
