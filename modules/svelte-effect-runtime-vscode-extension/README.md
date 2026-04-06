# Svelte Effect Runtime

This extension teaches the Svelte language server how to understand
`svelte-effect-runtime` syntax like:

- `<script effect>`
- `{yield* effect}`
- inline handlers such as `onclick={() => yield* effect}`

It works by shipping a patched Svelte language server and configuring the
official Svelte extension to use it.

## Commands

- `Svelte Effect Runtime: Enable Language Server`
- `Svelte Effect Runtime: Disable Language Server`

## Notes

You still need the real `svelte-effect-runtime` preprocess/plugin in your app
for builds and runtime behavior.
