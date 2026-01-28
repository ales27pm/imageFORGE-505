import { Directory, File } from "expo-file-system";
import { unzipSync } from "fflate";

async function ensureDirectory(path: string) {
  const dir = new Directory(path);
  await dir.create({ intermediates: true });
}

async function readBinaryFile(path: string): Promise<Uint8Array> {
  const file = new File(path);
  const data = await file.read();
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

async function writeBinaryFile(path: string, data: Uint8Array) {
  const file = new File(path);
  await file.create({ overwrite: true, intermediates: true });
  await file.write(data);
}

export async function unzipFileWithFflate(source: string, destination: string) {
  const zipData = await readBinaryFile(source);
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
