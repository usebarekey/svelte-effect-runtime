// deno-lint-ignore-file no-explicit-any
import path from "node:path";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import MagicString from "magic-string";
import { TraceMap } from "@jridgewell/trace-mapping";

const require = createRequire(import.meta.url);
const patch_marker = Symbol.for("svelte-effect-runtime.language-server.patch");
const package_root = path.dirname(fileURLToPath(import.meta.url));
const runtime_root = resolve_runtime_root(package_root);
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
)) as { Document: any };
const { SourceMapDocumentMapper } = require(path.join(
  language_server_root,
  "lib",
  "documents",
  "DocumentMapper.js",
)) as { SourceMapDocumentMapper: any };
const { extractScriptTags } = require(path.join(
  language_server_root,
  "lib",
  "documents",
  "utils.js",
)) as { extractScriptTags: (code: string) => any };
const { DocumentSnapshot } = require(path.join(
  language_server_root,
  "plugins",
  "typescript",
  "DocumentSnapshot.js",
)) as { DocumentSnapshot: any };
const {
  TranspiledSvelteDocument,
  FallbackTranspiledSvelteDocument,
} = require(path.join(
  language_server_root,
  "plugins",
  "svelte",
  "SvelteDocument.js",
)) as {
  TranspiledSvelteDocument: any;
  FallbackTranspiledSvelteDocument: any;
};

type Mapper = {
  getOriginalPosition(position: any): any;
  getGeneratedPosition(position: any): any;
  isInGenerated(position: any): boolean;
};

export async function bootstrap_language_server() {
  if (DocumentSnapshot.fromDocument[patch_marker]) {
    return;
  }

  const [
    preprocessModule,
    markupModule,
    transformModule,
  ] = await Promise.all([
    import_runtime_module("preprocess.js"),
    import_runtime_module("internal/markup.js"),
    import_runtime_module("internal/transform.js"),
  ]);

  patch_svelte_compiler_path(preprocessModule.effect_preprocess);
  patch_typescript_snapshot_path({
    transformEffectMarkup: markupModule.transformEffectMarkup,
    transformEffectScript: transformModule.transformEffectScript,
  });
}

function resolve_runtime_root(package_root: string) {
  const bundled_runtime_root = path.join(package_root, "runtime");
  const workspace_runtime_root = path.resolve(
    package_root,
    "..",
    "svelte-effect-runtime",
    "dist",
  );

  return existsSync(workspace_runtime_root)
    ? workspace_runtime_root
    : bundled_runtime_root;
}

function import_runtime_module(relativePath: string) {
  return import(pathToFileURL(path.join(runtime_root, relativePath)).href);
}

function patch_svelte_compiler_path(effectPreprocess: () => any) {
  patch_static_factory(TranspiledSvelteDocument, (originalCreate: any) => {
    return function create(this: unknown, document: unknown, config: any) {
      const preprocess = merge_preprocessors(config?.preprocess, effectPreprocess);
      return originalCreate.call(this, document, {
        ...config,
        preprocess,
      });
    };
  });

  patch_static_factory(FallbackTranspiledSvelteDocument, (originalCreate: any) => {
    return function create(
      this: unknown,
      document: unknown,
      preprocessors: any[] = [],
    ) {
      return originalCreate.call(
        this,
        document,
        merge_preprocessors(preprocessors, effectPreprocess),
      );
    };
  });
}

function patch_typescript_snapshot_path(
  transforms: {
    transformEffectMarkup: (code: string, options: { filename: string }) => {
      code: string;
      map: Record<string, unknown>;
    };
    transformEffectScript: (code: string, options: { filename: string }) => {
      code: string;
    };
  },
) {
  const original_from_document = DocumentSnapshot.fromDocument;

  DocumentSnapshot.fromDocument = function fromDocument(
    this: unknown,
    document: any,
    options: any,
  ) {
    const prepared = prepare_virtual_document(document, transforms);

    if (!prepared) {
      return original_from_document.call(this, document, options);
    }

    const snapshot = original_from_document.call(this, prepared.document, options);
    return rebind_snapshot_to_original_document(snapshot, document, prepared);
  };
  DocumentSnapshot.fromDocument[patch_marker] = true;

  DocumentSnapshot.fromSvelteFilePath = function fromSvelteFilePath(
    filePath: string,
    createDocument: (path: string, text: string) => any,
    options: any,
    tsSystem: { readFile(path: string): string | undefined },
  ) {
    const original_text = tsSystem.readFile(filePath) ?? "";
    return DocumentSnapshot.fromDocument(
      createDocument(filePath, original_text),
      options,
    );
  };
  DocumentSnapshot.fromSvelteFilePath[patch_marker] = true;
}

function patch_static_factory(
  target_class: any,
  makeReplacement: (originalCreate: any) => any,
) {
  if (target_class.create[patch_marker]) {
    return;
  }

  const original_create = target_class.create;
  target_class.create = makeReplacement(original_create);
  target_class.create[patch_marker] = true;
}

function merge_preprocessors(existing: any, effectPreprocess: () => any) {
  if (contains_effect_preprocessor(existing)) {
    return existing;
  }

  const next = effectPreprocess();

  if (!existing) {
    return [next];
  }

  if (Array.isArray(existing)) {
    return [next, ...existing];
  }

  return [next, existing];
}

function contains_effect_preprocessor(preprocessors: any) {
  if (!preprocessors) {
    return false;
  }

  const list = Array.isArray(preprocessors) ? preprocessors : [preprocessors];
  return list.some((preprocessor) => preprocessor?.name === "svelte-effect-runtime");
}

function prepare_virtual_document(
  originalDocument: any,
  transforms: {
    transformEffectMarkup: (code: string, options: { filename: string }) => {
      code: string;
      map: Record<string, unknown>;
    };
    transformEffectScript: (code: string, options: { filename: string }) => {
      code: string;
    };
  },
) {
  const originalText = originalDocument.getText();
  const filename = originalDocument.getFilePath() ?? "Component.svelte";
  const sourceUri = originalDocument.uri;

  const markupResult = transforms.transformEffectMarkup(originalText, {
    filename,
  });

  let currentCode = markupResult.code;
  let scriptMapper: Mapper | null = null;
  const scripts = extractScriptTags(currentCode);

  if (scripts?.script && has_own(scripts.script.attributes, "effect")) {
    const magicString = new MagicString(currentCode);
    const transformedScript = transforms.transformEffectScript(
      scripts.script.content,
      { filename },
    );

    if (transformedScript.code !== scripts.script.content) {
      magicString.overwrite(
        scripts.script.start,
        scripts.script.end,
        transformedScript.code,
      );
      currentCode = magicString.toString();
      scriptMapper = create_source_map_mapper(
        magicString.generateMap({
          hires: true,
          includeContent: true,
          source: sourceUri,
        }) as unknown as Record<string, unknown>,
        sourceUri,
      );
    }
  }

  const markupMapper = markupResult.code === originalText
    ? null
    : create_source_map_mapper(markupResult.map, sourceUri);

  if (!scriptMapper && !markupMapper) {
    return null;
  }

  const virtualDocument = Document.createForTest(sourceUri, currentCode);
  virtualDocument.version = originalDocument.version;
  virtualDocument.openedByClient = originalDocument.openedByClient;
  virtualDocument.config = originalDocument.config;
  virtualDocument.configPromise = originalDocument.configPromise;
  virtualDocument._compiler = originalDocument._compiler ?? originalDocument.compiler;
  virtualDocument.svelteVersion = originalDocument.svelteVersion;

  return {
    document: virtualDocument,
    preprocessMapper: new SequentialDocumentMapper(
      [scriptMapper, markupMapper].filter(Boolean) as Mapper[],
      sourceUri,
    ),
  };
}

function has_own(object: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function create_source_map_mapper(
  rawMap: Record<string, unknown>,
  sourceUri: string,
) {
  return new SourceMapDocumentMapper(
    new TraceMap({
      ...(rawMap as any),
      sources: [sourceUri],
    } as any),
    sourceUri,
  ) as Mapper;
}

function rebind_snapshot_to_original_document(
  snapshot: any,
  originalDocument: any,
  prepared: { document: any; preprocessMapper: Mapper },
) {
  const innerMapper = snapshot.getMapper();
  snapshot.mapper = new SnapshotDocumentMapper(
    innerMapper,
    prepared.preprocessMapper,
    originalDocument.uri,
  );

  if (snapshot.parserError) {
    snapshot.parserError = {
      ...snapshot.parserError,
      range: map_range(prepared.preprocessMapper, snapshot.parserError.range),
    };
  }

  if (snapshot.htmlAst) {
    snapshot.htmlAst = clone_ast_with_original_offsets(
      snapshot.htmlAst,
      prepared.document,
      originalDocument,
      prepared.preprocessMapper,
    );
  }

  snapshot.parent = originalDocument;
  snapshot.version = originalDocument.version;
  return snapshot;
}

function map_range(mapper: Mapper, range: { start: any; end: any }) {
  return {
    start: mapper.getOriginalPosition(range.start),
    end: mapper.getOriginalPosition(range.end),
  };
}

function clone_ast_with_original_offsets(
  value: any,
  preprocessedDocument: any,
  originalDocument: any,
  preprocessMapper: Mapper,
  seen = new WeakMap<object, any>(),
): any {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const clone: any[] = [];
    seen.set(value, clone);
    for (const item of value) {
      clone.push(
        clone_ast_with_original_offsets(
          item,
          preprocessedDocument,
          originalDocument,
          preprocessMapper,
          seen,
        ),
      );
    }
    return clone;
  }

  const clone = Object.create(Object.getPrototypeOf(value));
  seen.set(value, clone);

  for (const [key, child] of Object.entries(value)) {
    if ((key === "start" || key === "end") && typeof child === "number") {
      clone[key] = map_offset_to_original(
        child,
        preprocessedDocument,
        originalDocument,
        preprocessMapper,
      );
      continue;
    }

    clone[key] = clone_ast_with_original_offsets(
      child,
      preprocessedDocument,
      originalDocument,
      preprocessMapper,
      seen,
    );
  }

  return clone;
}

function map_offset_to_original(
  offset: number,
  preprocessedDocument: any,
  originalDocument: any,
  preprocessMapper: Mapper,
) {
  const originalPosition = preprocessMapper.getOriginalPosition(
    preprocessedDocument.positionAt(offset),
  );

  if (originalPosition.line < 0 || originalPosition.character < 0) {
    return offset;
  }

  return originalDocument.offsetAt(originalPosition);
}

class SequentialDocumentMapper {
  constructor(
    private readonly mappers: Mapper[],
    private readonly url: string,
  ) {}

  getOriginalPosition(generatedPosition: any) {
    return this.mappers.reduce(
      (position, mapper) => mapper.getOriginalPosition(position),
      generatedPosition,
    );
  }

  getGeneratedPosition(originalPosition: any) {
    return [...this.mappers].reverse().reduce(
      (position, mapper) => mapper.getGeneratedPosition(position),
      originalPosition,
    );
  }

  isInGenerated(originalPosition: any) {
    const generatedPosition = this.getGeneratedPosition(originalPosition);
    return generatedPosition.line >= 0 && generatedPosition.character >= 0;
  }

  getURL() {
    return this.url;
  }
}

class SnapshotDocumentMapper {
  constructor(
    private readonly innerMapper: Mapper,
    private readonly preprocessMapper: Mapper,
    private readonly url: string,
  ) {}

  getOriginalPosition(generatedPosition: any) {
    return this.preprocessMapper.getOriginalPosition(
      this.innerMapper.getOriginalPosition(generatedPosition),
    );
  }

  getGeneratedPosition(originalPosition: any) {
    return this.innerMapper.getGeneratedPosition(
      this.preprocessMapper.getGeneratedPosition(originalPosition),
    );
  }

  isInGenerated(originalPosition: any) {
    const preprocessedPosition =
      this.preprocessMapper.getGeneratedPosition(originalPosition);

    if (preprocessedPosition.line < 0 || preprocessedPosition.character < 0) {
      return false;
    }

    return this.innerMapper.isInGenerated(preprocessedPosition);
  }

  getURL() {
    return this.url;
  }
}
