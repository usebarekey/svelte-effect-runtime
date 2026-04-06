# `svelte-effect-runtime` Language Server

This is a custom bootstrap for the official `svelte-language-server`.

Instead of filtering diagnostics after the fact, it patches the language
server's real preprocessing and snapshot pipeline so the editor sees the same
Effect-aware Svelte syntax that the Vite/Svelte preprocess path sees.

That means raw `yield*` support is taught at the grammar/snapshot layer for:

- `<script effect>`
- markup expressions like `{yield* foo}`
- inline handlers like `onclick={() => yield* effect}`
- Svelte compiler/transpile diagnostics in the wrapped server process

## Install

```bash
cd /home/sander/personal/svelte-effect-runtime/tools/svelte-effect-runtime-language-server
npm install
```

## VS Code setup

Set this in your user settings:

```json
{
  "svelte.language-server.ls-path": "/home/sander/personal/svelte-effect-runtime/tools/svelte-effect-runtime-language-server/server.cjs"
}
```

The official Svelte VS Code extension will then launch this wrapper instead of its bundled server.

## Scope

This changes the editor language-server behavior only. Your runtime/build still
needs the real `svelte-effect-runtime` preprocess/plugin in the app itself.
