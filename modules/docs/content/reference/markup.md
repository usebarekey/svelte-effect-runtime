# markup

The markup transform handles supported `yield*` expressions outside `<script effect>`.

## Supported rewrite sites

- interpolation expressions: `{yield* expr}`
- event handlers
- `#if`
- `#each`
- `#await`
- key blocks
- spread attributes
- const tags

## Semantics

- Markup expressions are rewritten to runtime helper calls.
- Inline event handlers preserve Effect semantics and are executed through the active runtime.
- Markup-side `yield*` and `<script effect>` lowering are designed to coexist in the same component.
