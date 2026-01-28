import {
  base64ToUint8Array,
  buildImageFilename,
  buildImagePath,
  getImageExtension,
} from "../utils/imageUtils";

describe("image utils", () => {
  beforeAll(() => {
    if (!globalThis.atob) {
      globalThis.atob = (data: string) =>
        Buffer.from(data, "base64").toString("binary");
    }
  });

  it("returns jpeg extension for jpeg mime types", () => {
    expect(getImageExtension("image/jpeg")).toBe("jpeg");
    expect(getImageExtension("image/jpg")).toBe("jpeg");
  });

  it("defaults to png extension for other mime types", () => {
    expect(getImageExtension("image/png")).toBe("png");
    expect(getImageExtension()).toBe("png");
  });

  it("handles malformed mime types defensively", () => {
    expect(getImageExtension(123 as unknown as string)).toBe("png");
    expect(getImageExtension({} as unknown as string)).toBe("png");
  });

  it("returns extensions for additional mime types", () => {
    expect(getImageExtension("image/webp")).toBe("webp");
    expect(getImageExtension("image/gif")).toBe("gif");
    expect(getImageExtension("image/heic")).toBe("heic");
    expect(getImageExtension("image/heif")).toBe("heif");
  });

  it("builds filenames based on ids and mime types", () => {
    expect(buildImageFilename("abc", "image/jpeg")).toBe("abc.jpeg");
    expect(buildImageFilename("xyz", "image/webp")).toBe("xyz.webp");
    expect(buildImageFilename("fallback", undefined)).toBe("fallback.png");
  });

  it("builds paths using the base directory", () => {
    expect(buildImagePath("file:///tmp/", "img1", "image/png")).toBe(
      "file:///tmp/img1.png",
    );
    expect(buildImagePath("file:///tmp", "img2", "image/jpeg")).toBe(
      "file:///tmp/img2.jpeg",
    );
  });

  it("returns empty array for undefined base64", () => {
    expect(base64ToUint8Array()).toEqual(new Uint8Array(0));
  });

  it("decodes base64 strings with padding fixes", () => {
    const text = "hello";
    const encoded = Buffer.from(text).toString("base64");
    const bytes = base64ToUint8Array(encoded.replace(/=+$/, ""));
    const decoded = Buffer.from(bytes).toString("utf8");
    expect(decoded).toBe(text);
  });
});
