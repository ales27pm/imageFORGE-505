export function getImageExtension(mimeType?: string) {
  if (typeof mimeType !== "string") {
    return "png";
  }
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "jpeg";
  }
  if (normalized === "image/png") {
    return "png";
  }
  if (normalized === "image/webp") {
    return "webp";
  }
  if (normalized === "image/gif") {
    return "gif";
  }
  if (normalized === "image/heic") {
    return "heic";
  }
  if (normalized === "image/heif") {
    return "heif";
  }
  return "png";
}

export function buildImageFilename(id: string, mimeType?: string): string {
  const extension = getImageExtension(mimeType);
  return `${id}.${extension}`;
}

export function buildImagePath(
  baseDirUri: string,
  id: string,
  mimeType?: string,
): string {
  const normalizedBase = baseDirUri.endsWith("/")
    ? baseDirUri
    : `${baseDirUri}/`;
  return `${normalizedBase}${buildImageFilename(id, mimeType)}`;
}

export function base64ToUint8Array(base64?: string): Uint8Array {
  if (!base64) {
    return new Uint8Array(0);
  }
  // Trim whitespace/newlines (we already remove data URL prefixes upstream)
  let clean = base64.replace(/[\r\n\s]+/g, "");
  // Hermès atob requires the length to be a multiple of 4
  const remainder = clean.length % 4;
  if (remainder === 2) {
    clean += "==";
  } else if (remainder === 3) {
    clean += "=";
  } else if (remainder === 1) {
    // Rare case: add three '='
    clean += "===";
  }
  const binaryString = globalThis.atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
