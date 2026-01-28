import { Directory, File } from "expo-file-system";
import { GeneratedImage } from "@/types/image";
import { base64ToUint8Array, buildImageFilename } from "@/utils/imageUtils";

export async function ensureImagesDirExists(imagesDir: Directory | null) {
  if (!imagesDir) return;
  try {
    await imagesDir.create({ intermediates: true });
  } catch (err) {
    console.warn("[imageStorage] Failed to create images directory:", err);
  }
}

export async function hydrateStoredImages(
  images: GeneratedImage[],
  imagesDir: Directory | null,
): Promise<GeneratedImage[]> {
  if (!imagesDir) return images;

  let existingFiles: string[] = [];
  try {
    const contents = await imagesDir.list();
    existingFiles = contents
      .filter((item): item is File => !(item instanceof Directory))
      .map((fileItem) => fileItem.uri.split("/").pop() || "");
  } catch (e) {
    console.warn("[imageStorage] Failed to read images directory:", e);
  }

  const existingFilesSet = new Set(existingFiles);
  console.log("[imageStorage] Found", existingFiles.length, "files on disk");

  return Promise.all(
    images.map(async (img) => {
      const updated = { ...img };
      const filename = buildImageFilename(updated.id, updated.mimeType);
      const file = new File(imagesDir, filename);
      const expectedUri = file.uri;

      if (existingFilesSet.has(filename)) {
        updated.uri = expectedUri;
      } else if (updated.base64Data && updated.base64Data.length > 100) {
        console.warn("[imageStorage] File missing for image:", updated.id);
        try {
          console.log(
            "[imageStorage] Restoring file from base64 for:",
            updated.id,
          );
          await file.create({ overwrite: true, intermediates: true });
          const bytes = base64ToUint8Array(updated.base64Data);
          await file.write(bytes);
          updated.uri = file.uri;
        } catch (err) {
          console.error("[imageStorage] Failed to restore file:", err);
          updated.uri = "";
        }
      } else {
        updated.uri = "";
      }
      return updated;
    }),
  );
}

export async function persistImageToFileSystem(
  image: GeneratedImage,
  imagesDir: Directory | null,
): Promise<GeneratedImage> {
  if (!imagesDir || !image.base64Data) {
    return image;
  }

  const filename = buildImageFilename(image.id, image.mimeType);
  const file = new File(imagesDir, filename);

  try {
    await file.create({ overwrite: true, intermediates: true });
    const bytes = base64ToUint8Array(image.base64Data);
    await file.write(bytes);

    const fileExists = file.exists;
    const fileSize = file.size;

    if (fileExists) {
      console.log(
        "[imageStorage] Saved image to:",
        file.uri,
        "size:",
        fileSize,
      );

      if (fileSize != null && fileSize < 100) {
        console.error(
          "[imageStorage] File write appeared to succeed but file is missing or empty",
        );
      }
    } else {
      console.error("[imageStorage] File write failed, file does not exist");
    }

    return { ...image, uri: file.uri };
  } catch (error) {
    console.error("[imageStorage] Failed to save image to file system:", error);
    throw error;
  }
}
