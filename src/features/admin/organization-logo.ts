export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_BUCKET = "organization-logos";

/** Reject SVG/HTML and mismatched MIME; storage also enforces MIME and size. */
export function logoFileType(bytes: Uint8Array, mime: string) {
  if (bytes.length < 16 || bytes.length > LOGO_MAX_BYTES) return null;
  const start = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (mime === "image/png" && start([137, 80, 78, 71, 13, 10, 26, 10])) return "png";
  if (mime === "image/jpeg" && start([255, 216, 255])) return "jpg";
  if (mime === "image/webp" && start([82, 73, 70, 70]) && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
