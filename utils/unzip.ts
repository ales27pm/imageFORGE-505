import * as FileSystem from "expo-file-system";
import { unzipSync } from "fflate";
import { fromByteArray, toByteArray } from "base64-js";

const base64Encoding = FileSystem.EncodingType.Base64;

async function ensureDirectory(path: string) {
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}

async function writeBinaryFile(path: string, data: Uint8Array) {
  const base64 = fromByteArray(data);
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: base64Encoding,
  });
}

export async function unzipFileWithFflate(source: string, destination: string) {
  const base64Zip = await FileSystem.readAsStringAsync(source, {
    encoding: base64Encoding,
  });
  const zipData = toByteArray(base64Zip);
  const entries = unzipSync(zipData);

  await ensureDirectory(destination);

  const entryNames = Object.keys(entries);
  for (const entryName of entryNames) {
    const data = entries[entryName];
    const outputPath = `${destination}${entryName}`;
    const dirIndex = outputPath.lastIndexOf("/");
    if (dirIndex !== -1) {
      const dirPath = outputPath.slice(0, dirIndex + 1);
      await ensureDirectory(dirPath);
    }
    await writeBinaryFile(outputPath, data);
  }
}
