import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  assert,
  assertEquals as assert_equals,
  assertMatch as assert_match,
  assertNotMatch as assert_not_match,
} from "@std/assert";
import { bootstrap_language_server } from "./server.ts";

const require = createRequire(import.meta.url);
const language_server_root = path.join(
  path.dirname(require.resolve("svelte-language-server/package.json")),
  "dist",
  "src",
);
const { Document } = require(path.join(
  language_server_root,
  "lib",
  "documents",
  "Document.js",
));
const { DocumentSnapshot } = require(path.join(
  language_server_root,
  "plugins",
  "typescript",
  "DocumentSnapshot.js",
));
const { SvelteDocument } = require(path.join(
  language_server_root,
  "plugins",
  "svelte",
  "SvelteDocument.js",
));

await bootstrap_language_server();

async function load_compiler() {
  const module = await import(
    pathToFileURL(require.resolve("svelte/compiler")).href,
  );

  return module.default ?? module["module.exports"] ?? module;
}

async function create_transform_options() {
  const compiler = await load_compiler();
  return {
    parse: compiler.parse,
    version: compiler.VERSION,
    transformOnTemplateError: false,
    typingsNamespace: "svelteHTML",
  };
}

Deno.test("builds a mappable TS snapshot from Effect syntax", async () => {
  const source = `<script lang="ts" effect>
  import { Effect } from "effect";

  let count = $state(2);
  const pokemon = Effect.tryPromise({
    try: async () => {
      const response = await fetch("https://pokeapi.co/api/v2/pokemon/1");
      return await response.json();
    },
    catch: (error) => error
  }).pipe(Effect.map((data) => data.name));

  const increment = Effect.gen(function* () {
    count = count * count;
  });
</script>

<button onclick={() => yield* increment}>Increment</button>
<p>{yield* pokemon}</p>
<p>{count}</p>`;

  const document = Document.createForTest(
    "file:///virtual/snapshot.svelte",
    source,
  );
  const options = await create_transform_options();
  const snapshot = DocumentSnapshot.fromDocument(document, options);

  assert_equals(snapshot.parserError, null);

  const count_offset = source.lastIndexOf("{count}") + 1;
  const count_position = document.positionAt(count_offset);
  const generated_count = snapshot.getGeneratedPosition(count_position);
  assert(generated_count.line >= 0);
  assert_equals(snapshot.getOriginalPosition(generated_count), count_position);

  const pokemon_offset = source.indexOf("pokemon}</p>");
  const node = snapshot.svelteNodeAt(pokemon_offset);
  assert(node);
  assert(node.start <= pokemon_offset);
  assert(node.end >= pokemon_offset);
});

Deno.test("injects the runtime preprocessor into the Svelte compiler path", async () => {
  const compiler = await load_compiler();
  const source = `<script lang="ts" effect>
  import { Effect } from "effect";
  const count = yield* Effect.succeed(42);
</script>

<p>{count}</p>`;

  const document = Document.createForTest(
    "file:///virtual/transpile.svelte",
    source,
  );
  document._compiler = compiler;

  const transpiled = await new SvelteDocument(document).getTranspiled();

  assert_match(transpiled.getText(), /runComponentEffect/);
  assert_not_match(transpiled.getText(), /<script[^>]*effect/);
});
