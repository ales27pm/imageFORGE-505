export function getImageExtension(mimeType?: string) {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "jpeg";
  }
  return "png";
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
