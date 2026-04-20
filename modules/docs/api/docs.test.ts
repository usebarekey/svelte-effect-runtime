import { createDocsResponse, negotiateContentType } from "./_docs.ts";

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
