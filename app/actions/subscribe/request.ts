export function isSameOriginRequest(request: Request, url: URL): boolean {
  let origin = request.headers.get("Origin");
  if (origin) return origin === url.origin;
  let referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === url.origin;
  } catch {
    return false;
  }
}

export async function readBoundedForm(request: Request): Promise<FormData> {
  let contentType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim();
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new TypeError("Unsupported subscription form content type");
  }
  let declaredLength = Number(request.headers.get("Content-Length"));
  if (declaredLength > 4096)
    throw new TypeError("Subscription form is too large");

  let reader = request.body?.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      let { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      if (total > 4096) {
        await reader.cancel();
        throw new TypeError("Subscription form is too large");
      }
      chunks.push(value);
    }
  }
  let bytes = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let form = new FormData();
  for (let [name, value] of new URLSearchParams(
    new TextDecoder().decode(bytes),
  )) {
    form.append(name, value);
  }
  return form;
}

export async function rateLimitKeys(
  buyerIp: string,
  email: string,
): Promise<[string, string]> {
  return Promise.all([
    oneWayDigest(`ip:${buyerIp}`),
    oneWayDigest(`email:${email}`),
  ]);
}

async function oneWayDigest(value: string): Promise<string> {
  let digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
