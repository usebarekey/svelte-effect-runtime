import handler from "./docs.js";
import { createDocsResponse, negotiateContentType } from "./_docs.js";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertStringIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`Expected string to include ${JSON.stringify(expected)}`);
  }
}

Deno.test("prefers markdown when it is explicitly ranked first", () => {
  assertEquals(
    negotiateContentType("text/markdown, text/html;q=0.8, */*;q=0.1"),
    "text/markdown",
  );
});

Deno.test("falls back to html for wildcard accept headers", () => {
  assertEquals(negotiateContentType("*/*"), "text/html");
});

Deno.test("returns 406 when neither html nor markdown is acceptable", async () => {
  const response = await createDocsResponse(
    new Request("https://ser.barekey.dev/tooling", {
      headers: {
        accept: "application/json",
      },
    }),
  );

  assertEquals(response.status, 406);
  assertEquals(response.headers.get("vary"), "Accept");
});

Deno.test("serves canonical docs pages as markdown", async () => {
  const response = await createDocsResponse(
    new Request("https://ser.barekey.dev/tooling", {
      headers: {
        accept: "text/markdown",
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8",
  );
  assertEquals(response.headers.get("vary"), "Accept");
  assertStringIncludes(await response.text(), "# Tooling");
});

Deno.test("serves canonical docs pages as html by default", async () => {
  const response = await createDocsResponse(
    new Request("https://ser.barekey.dev/content/reference/effect"),
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/html; charset=utf-8",
  );
  assertEquals(response.headers.get("vary"), "Accept");
  assertStringIncludes(await response.text(), "<!DOCTYPE html>");
});

Deno.test("handles vercel-style relative request urls", async () => {
  const response = await createDocsResponse({
    method: "GET",
    url: "/tooling",
    headers: {
      accept: "text/markdown",
      "x-forwarded-host": "ser.barekey.dev",
      "x-forwarded-proto": "https",
    },
  });

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8",
  );
  assertEquals(response.headers.get("vary"), "Accept");
  assertStringIncludes(await response.text(), "# Tooling");
});

Deno.test("writes negotiated responses to a node-style serverless response", async () => {
  let endedBody: Uint8Array | null = null;
  const headers: Record<
    string,
    string | number | readonly string[] | undefined
  > = {};
  const response = {
    statusCode: 0,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name] = value;
    },
    end(value?: Uint8Array | string) {
      endedBody = typeof value === "string"
        ? new TextEncoder().encode(value)
        : value ?? null;
    },
  };

  await handler(
    {
      method: "GET",
      url: "/tooling",
      headers: {
        accept: "text/markdown",
        "x-forwarded-host": "ser.barekey.dev",
        "x-forwarded-proto": "https",
      },
    },
    response,
  );

  assertEquals(headers["content-type"], "text/markdown; charset=utf-8");
  assertEquals(headers["vary"], "Accept");
  assertStringIncludes(
    new TextDecoder().decode(endedBody ?? new Uint8Array()),
    "# Tooling",
  );
});
