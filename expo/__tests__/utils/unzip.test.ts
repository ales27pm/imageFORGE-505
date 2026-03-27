import { zipSync } from "fflate";
import { fromByteArray } from "base64-js";
import { unzipFileWithFflate } from "../../utils/unzip";

const writeCalls: Array<{ path: string; data: string }> = [];
const mkdirCalls: string[] = [];

jest.mock("expo-file-system", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(async (path: string, data: string) => {
    writeCalls.push({ path, data });
  }),
  makeDirectoryAsync: jest.fn(async (path: string) => {
    mkdirCalls.push(path);
  }),
}));

const FileSystem = require("expo-file-system");

describe("unzipFileWithFflate", () => {
  beforeEach(() => {
    writeCalls.length = 0;
    mkdirCalls.length = 0;
  });

  it("extracts zip contents to destination", async () => {
    const zipData = zipSync({
      "model/TextEncoder.mlmodelc": Buffer.from("encoder-data"),
      "model/config.json": Buffer.from('{"a":1}'),
    });
    const base64Zip = fromByteArray(zipData);
    FileSystem.readAsStringAsync.mockResolvedValue(base64Zip);

    await unzipFileWithFflate("model.zip", "/dest/");

    const written = new Map(writeCalls.map((call) => [call.path, call.data]));
    const encoderData = Buffer.from(
      written.get("/dest/model/TextEncoder.mlmodelc") ?? "",
      "base64",
    ).toString("utf8");
    const configData = Buffer.from(
      written.get("/dest/model/config.json") ?? "",
      "base64",
    ).toString("utf8");

    expect(encoderData).toBe("encoder-data");
    expect(configData).toBe('{"a":1}');
    expect(mkdirCalls).toContain("/dest/");
    expect(mkdirCalls).toContain("/dest/model/");
  });
});
