import { createDocsResponse } from "./_docs";

export default function handler(request: Request): Promise<Response> {
  return createDocsResponse(request);
}
