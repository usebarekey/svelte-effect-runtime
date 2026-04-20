import { createDocsResponse } from "./_docs.js";

export default function handler(request) {
  return createDocsResponse(request);
}
