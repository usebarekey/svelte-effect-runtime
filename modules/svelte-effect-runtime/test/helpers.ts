import { assertExists } from "@std/assert";
import { dirname, fromFileUrl, join, toFileUrl } from "@std/path";
import { compile, type CompileOptions, preprocess } from "svelte/compiler";
import { JSDOM } from "jsdom";
import {
  effectPreprocess,
  type EffectPreprocessOptions,
} from "../preprocess.ts";

interface CompiledModule {
  default: unknown;
}

interface LoadedDom {
  cleanup(): void;
  document: Document;
}

interface CompileFixtureModuleOptions extends EffectPreprocessOptions {
  compileOptions?: Partial<CompileOptions>;
}

const ORIGINAL_GLOBALS = new Map<string, unknown>();
const WORKSPACE_ROOT = fromFileUrl(new URL("../../../", import.meta.url));
const SVELTE_CLIENT_MODULE_URL = new URL(
  "../../../node_modules/svelte/src/index-client.js",
  import.meta.url,
);

export async function compileFixtureModule(
  files: Record<string, string>,
  entrypoint: string,
  options: CompileFixtureModuleOptions = {},
): Promise<CompiledModule> {
  const tempRoot = join(Deno.cwd(), ".tmp");
  await Deno.mkdir(tempRoot, { recursive: true });
  const tempDir = await Deno.makeTempDir({
    dir: tempRoot,
    prefix: "svelte-effect-runtime-",
  });

  const preprocessOptions: EffectPreprocessOptions = {
    runtimeModuleId: options.runtimeModuleId ??
      toFileUrl(join(Deno.cwd(), "test/support/client-runtime.ts")).href,
    effectModuleId: options.effectModuleId,
    svelteModuleId: options.svelteModuleId ??
      SVELTE_CLIENT_MODULE_URL.href,
  };

  for (const [relativePath, source] of Object.entries(files)) {
    const absolutePath = join(tempDir, relativePath);
    await Deno.mkdir(dirname(absolutePath), { recursive: true });

    if (!relativePath.endsWith(".svelte")) {
      await Deno.writeTextFile(absolutePath, source);
      continue;
    }

    const preprocessed = await preprocess(
      source,
      effectPreprocess(preprocessOptions),
      {
        filename: absolutePath,
      },
    );
    const compiled = compile(preprocessed.code, {
      filename: absolutePath,
      dev: true,
      ...options.compileOptions,
    });

    const outputPath = absolutePath.replace(/\.svelte$/, ".js");
    const rewrittenImports = compiled.js.code.replaceAll(
      /\.svelte(["'])/g,
      ".js$1",
    );
    await Deno.writeTextFile(outputPath, rewrittenImports);
  }

  const modulePath = join(tempDir, entrypoint.replace(/\.svelte$/, ".js"));
  return await import(toFileUrl(modulePath).href) as CompiledModule;
}

export function installDom(): LoadedDom {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    Text: dom.window.Text,
    Comment: dom.window.Comment,
    DocumentFragment: dom.window.DocumentFragment,
    SVGElement: dom.window.SVGElement,
    CustomEvent: dom.window.CustomEvent,
    Event: dom.window.Event,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (handle: number) => clearTimeout(handle),
  };

  for (const [key, value] of Object.entries(globals)) {
    if (!ORIGINAL_GLOBALS.has(key)) {
      ORIGINAL_GLOBALS.set(key, (globalThis as Record<string, unknown>)[key]);
    }
    (globalThis as Record<string, unknown>)[key] = value;
  }

  return {
    document: dom.window.document,
    cleanup() {
      for (const [key, original] of ORIGINAL_GLOBALS.entries()) {
        if (original === undefined) {
          delete (globalThis as Record<string, unknown>)[key];
        } else {
          (globalThis as Record<string, unknown>)[key] = original;
        }
      }
      ORIGINAL_GLOBALS.clear();
      dom.window.close();
    },
  };
}

export async function mountComponent(
  module: CompiledModule,
  target: Element,
  props?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  assertExists(module.default);
  const { flushSync, mount } = await import(SVELTE_CLIENT_MODULE_URL.href);
  const component = mount(module.default as never, { target, props }) as Record<
    string,
    unknown
  >;
  flushSync();
  return component;
}

export async function destroyComponent(
  component: Record<string, unknown>,
): Promise<void> {
  const { unmount } = await import(SVELTE_CLIENT_MODULE_URL.href);
  await unmount(component);
}

export async function flushEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function repoFile(relativePath: string): string {
  return fromFileUrl(new URL(`../${relativePath}`, import.meta.url));
}

export function workspaceFile(relativePath: string): string {
  return join(WORKSPACE_ROOT, relativePath);
}
