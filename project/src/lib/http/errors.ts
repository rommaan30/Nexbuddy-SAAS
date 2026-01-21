export type ApiErrorBody = { error: string };

export function badRequest(message: string): Response {
  return Response.json({ error: message } satisfies ApiErrorBody, { status: 400 });
}

export function unauthorized(message = "Unauthorized"): Response {
  return Response.json({ error: message } satisfies ApiErrorBody, { status: 401 });
}

export function internalError(message = "Internal Server Error"): Response {
  return Response.json({ error: message } satisfies ApiErrorBody, { status: 500 });
}


