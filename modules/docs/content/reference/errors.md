# Errors

These are the core error and validation types exposed by the runtime.

## Signatures

```ts
export interface FormIssue {
  readonly message: string;
  readonly path: ReadonlyArray<string | number>;
}
```

```ts
export interface FormError<SchemaType = unknown> {
  readonly _tag: "FormError";
  readonly issues: ReadonlyArray<FormIssue>;
  readonly _schema?: SchemaType | undefined;
}
```

```ts
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
```
