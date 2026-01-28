import { zipSync } from "fflate";
import { unzipFileWithFflate } from "../../utils/unzip";

const mockWriteCalls: Array<{ path: string; data: Uint8Array }> = [];
const mockMkdirCalls: string[] = [];
const mockReadMap = new Map<string, Uint8Array>();

jest.mock("expo-file-system", () => ({
  Directory: class MockDirectory {
    uri: string;

    constructor(path: string) {
      this.uri = path;
    }

    async create() {
      mockMkdirCalls.push(this.uri);
    }
  },
  File: class MockFile {
    uri: string;

    constructor(pathOrDir: string | { uri: string }, name?: string) {
      if (typeof pathOrDir === "string") {
        this.uri = pathOrDir;
      } else {
        this.uri = `${pathOrDir.uri}${name ?? ""}`;
      }
    }

    async create() {
      return undefined;
    }

    async write(data: Uint8Array) {
      mockWriteCalls.push({ path: this.uri, data });
    }

    async read() {
      const data = mockReadMap.get(this.uri);
      if (!data) {
        throw new Error(`Missing mock data for ${this.uri}`);
      }
      return data;
    }
  },
}));

describe("unzipFileWithFflate", () => {
  beforeEach(() => {
    mockWriteCalls.length = 0;
    mockMkdirCalls.length = 0;
    mockReadMap.clear();
  });

  it("extracts zip contents to destination", async () => {
    const zipData = zipSync({
      "model/TextEncoder.mlmodelc": Buffer.from("encoder-data"),
      "model/config.json": Buffer.from('{"a":1}'),
    });
    mockReadMap.set("model.zip", zipData);

    await unzipFileWithFflate("model.zip", "/dest/");

    const written = new Map(
      mockWriteCalls.map((call) => [call.path, call.data]),
    );
    const encoderData = Buffer.from(
      written.get("/dest/model/TextEncoder.mlmodelc") ?? new Uint8Array(),
    ).toString("utf8");
    const configData = Buffer.from(
      written.get("/dest/model/config.json") ?? new Uint8Array(),
    ).toString("utf8");

    expect(encoderData).toBe("encoder-data");
    expect(configData).toBe('{"a":1}');
    expect(mockMkdirCalls).toContain("/dest/");
    expect(mockMkdirCalls).toContain("/dest/model/");
  });
});
