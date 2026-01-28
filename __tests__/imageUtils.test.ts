import { base64ToUint8Array, getImageExtension } from "../utils/imageUtils";

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
