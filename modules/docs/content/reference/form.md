# Form

`Form` wraps SvelteKit `form(...)`. It preserves the native form object surface and adds an Effect-returning `submit(...)`.

```ts
import { Form } from "svelte-effect-runtime";
```

## Signatures

```ts
type EffectForm<Input extends RemoteFormInput | void, Output, Error = never> =
  RemoteForm<Input, Output> & {
    native: RemoteForm<Input, Output>;
    submit(
      data: OptionalArgument<Input>
    ): Effect.Effect<Output, RemoteFailure<Error>, never>;
    for: RemoteForm<Input, Output>["for"] extends (...args: infer Args) => infer Result
      ? (...args: Args) => EffectForm<Input, Output, Error>
      : never;
  };
```

```ts
interface EffectFormFactory {
  <Output, ErrorType, Requirements>(
    fn: () => Effect.Effect<Output, ErrorType, Requirements>
  ): EffectForm<void, Output, ErrorType>;

  <Input extends RemoteFormInput, Output, ErrorType, Requirements>(
    validate: "unchecked",
    fn: (args: {
      data: Input;
      invalid: Invalid;
    }) => Effect.Effect<Output, ErrorType | FormError, Requirements>
  ): EffectForm<Input, Output, ErrorType>;

  <SchemaType extends EffectSchema, Output, ErrorType, Requirements>(
    validate: SchemaType,
    fn: (args: {
      data: SchemaOutput<SchemaType>;
      invalid: Invalid<SchemaType>;
    }) => Effect.Effect<
      Output,
      ErrorType | FormError<SchemaType>,
      Requirements
    >
  ): EffectForm<
    SchemaInput<SchemaType> & RemoteFormInput,
    Output,
    ErrorType
  >;
}
```

## `invalid`

```ts
type Invalid<SchemaType = unknown> = {
  form: (message: string) => Effect.Effect<never, FormError<SchemaType>, never>;
} & FieldHelpers<...>;
```

Schema-backed forms derive top-level field helpers from the schema output shape.
