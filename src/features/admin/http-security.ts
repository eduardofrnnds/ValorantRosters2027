/** Native same-origin form POSTs only; never infer trust from a return URL. */
export function isSameOriginPost(request: Request) {
  if (request.method !== "POST") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(request.url);
    // Next may normalize request.url to its internal hostname. Compare the
    // browser's Origin with the incoming Host; never trust X-Forwarded-Host here.
    const host = request.headers.get("host") ?? url.host;
    return new URL(origin).origin === `${url.protocol}//${host}`;
  }
  catch { return false; }
}

export function privateHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "same-origin",
  };
}

/** Shared stream limit for CRUD forms and optional image upload. */
export async function readBoundedBody(request: Request, limit: number) {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  } finally { reader.releaseLock(); }
}

export async function readAdminForm(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") return null;
  const bytes = await readBoundedBody(request, 16_384);
  if (!bytes) return null;
  const params = new URLSearchParams(new TextDecoder().decode(bytes));
  if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) return null;
  return Object.fromEntries(params);
}

/** Bound the actual stream, not just the attacker-controlled Content-Length. */
export async function readLoginForm(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16_384) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const params = new URLSearchParams(new TextDecoder().decode(bytes));
    if (params.getAll("email").length !== 1 || params.getAll("password").length !== 1) return null;
    return { email: params.get("email"), password: params.get("password") };
  } finally { reader.releaseLock(); }
}
