import { Buffer } from "node:buffer";
import { createDocsResponse } from "./_docs.js";

export default async function handler(request, response) {
  const docsResponse = await createDocsResponse(request);
  if (!response) {
    return docsResponse;
  }

  response.statusCode = docsResponse.status;
  docsResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  const method = (request.method ?? "GET").toUpperCase();
  if (method === "HEAD" || docsResponse.body === null) {
    response.end();
    return;
  }

  const body = Buffer.from(await docsResponse.arrayBuffer());
  response.end(body);
}
