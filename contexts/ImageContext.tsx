import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { GeneratedImage, AspectRatio, ASPECT_RATIO_MAP } from "@/types/image";
import { File, Directory, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system";
import Constants from "expo-constants";
import { unzip } from "react-native-zip-archive";
import { base64ToUint8Array, getImageExtension } from "@/utils/imageUtils";

let ExpoStableDiffusion: any;
let isModelLoaded = false;
if (Platform.OS === "ios") {
  try {
    ExpoStableDiffusion = require("expo-stable-diffusion");
  } catch (e) {
    console.warn("[ImageContext] expo-stable-diffusion not available");
  }
}

const STORAGE_KEY = "ai_forge_images";
const MAX_STORED_IMAGES = 10;
const MODEL_PARENT_DIR = (FileSystem.documentDirectory || "") + "Model/";
const MODEL_DIR = `${MODEL_PARENT_DIR}stable-diffusion-2-1/`;
const MODEL_ZIP_PATH = `${MODEL_PARENT_DIR}stable-diffusion-2-1.zip`;
const DEFAULT_MODEL_ZIP_URL =
  "https://huggingface.co/andrei-zgirvaci/coreml-stable-diffusion-2-1-split-einsum-v2-txt2img/resolve/main/coreml-stable-diffusion-2-1-split-einsum-v2-cpu-and-ne-txt2img.zip";
const MODEL_ZIP_URL =
  Constants.expoConfig?.extra?.stableDiffusionModelZipUrl ??
  DEFAULT_MODEL_ZIP_URL;

const imagesDir =
  Platform.OS !== "web" ? new Directory(Paths.document, "images") : null;

async function ensureDirExists() {
  if (Platform.OS === "web" || !imagesDir) return;
  try {
    await imagesDir.create({ intermediates: true });
  } catch (err) {
    console.warn("[ImageContext] Failed to create images directory:", err);
  }
}

async function findModelCandidate(modelParentDir: string) {
  const entries = await FileSystem.readDirectoryAsync(modelParentDir);
  for (const entry of entries) {
    if (entry === "stable-diffusion-2-1" || entry.startsWith(".")) {
      continue;
    }
    const candidate = `${modelParentDir}${entry}`;
    const info = await FileSystem.getInfoAsync(candidate);
    if (!info.exists || !info.isDirectory) {
      continue;
    }
    const candidateEntries = await FileSystem.readDirectoryAsync(candidate);
    if (candidateEntries.includes("TextEncoder.mlmodelc")) {
      return candidate;
    }
  }
  return null;
}

async function ensureModelAvailable() {
  if (Platform.OS !== "ios" || !ExpoStableDiffusion) {
    return;
  }
  await FileSystem.makeDirectoryAsync(MODEL_PARENT_DIR, {
    intermediates: true,
  });
  const modelInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (modelInfo.exists && modelInfo.isDirectory) {
    return;
  }

  console.log("[ImageContext] Downloading Core ML model to device...");
  try {
    await FileSystem.downloadAsync(MODEL_ZIP_URL, MODEL_ZIP_PATH);
  } catch (error) {
    console.error(
      "[ImageContext] Failed to download Core ML model zip:",
      error,
    );
    throw error;
  }

  console.log("[ImageContext] Unzipping Core ML model...");
  try {
    await unzip(MODEL_ZIP_PATH, MODEL_PARENT_DIR);
    await FileSystem.deleteAsync(MODEL_ZIP_PATH, { idempotent: true });
  } catch (error) {
    console.error("[ImageContext] Failed to unzip Core ML model:", error);
    throw error;
  }

  const finalModelInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (finalModelInfo.exists && finalModelInfo.isDirectory) {
    return;
  }

  const candidate = await findModelCandidate(MODEL_PARENT_DIR);
  if (candidate) {
    await FileSystem.moveAsync({ from: candidate, to: MODEL_DIR });
    return;
  }

  throw new Error("[ImageContext] Model extraction failed.");
}

async function generateImageAPI(
  prompt: string,
  size: string,
): Promise<{
  image: { base64Data: string; mimeType: string };
  size: string;
}> {
  console.log("[ImageContext] Generating image with prompt:", prompt);

  const response = await fetch("https://toolkit.rork.com/images/generate/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, size }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ImageContext] Generation failed:", errorText);
    throw new Error("Failed to generate image");
  }

  const data = await response.json();
  console.log("[ImageContext] Image generated successfully");
  console.log("[ImageContext] Data mimeType:", data.image.mimeType);
  console.log("[ImageContext] Base64 length:", data.image.base64Data?.length);

  if (data.image?.base64Data) {
    let b64 = data.image.base64Data.replace(/[\r\n\s]+/g, "");

    if (b64.startsWith("data:")) {
      const commaIndex = b64.indexOf(",");
      if (commaIndex !== -1) {
        b64 = b64.substring(commaIndex + 1);
      }
    }

    console.log("[ImageContext] Base64 processed length:", b64.length);
    console.log("[ImageContext] Base64 prefix:", b64.substring(0, 50));

    data.image.base64Data = b64;
  }

  if (!data.image.mimeType) {
    data.image.mimeType = "image/png";
  }

  return data;
}

export const [ImageProvider, useImages] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<AspectRatio>("1:1");

  const imagesQuery = useQuery({
    queryKey: ["generated-images"],
    queryFn: async () => {
      console.log("[ImageContext] Loading images from storage");
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const images = stored ? JSON.parse(stored) : [];

      if (Platform.OS === "web") {
        return images as GeneratedImage[];
      }

      await ensureDirExists();

      let existingFiles: string[] = [];
      try {
        if (imagesDir) {
          const contents = await imagesDir.list();
          existingFiles = contents
            .filter((item): item is File => !(item instanceof Directory))
            .map((fileItem) => {
              const parts = fileItem.uri.split("/");
              return parts[parts.length - 1];
            });
        }
      } catch (e) {
        console.warn("[ImageContext] Failed to read images directory:", e);
      }

      const existingFilesSet = new Set(existingFiles);
      console.log(
        "[ImageContext] Found",
        existingFiles.length,
        "files on disk",
      );

      const validImages = await Promise.all(
        images.map(async (img: GeneratedImage) => {
          const extension = getImageExtension(img.mimeType);
          const filename = `${img.id}.${extension}`;
          const file = imagesDir ? new File(imagesDir, filename) : null;
          const expectedUri = file?.uri || "";

          if (existingFilesSet.has(filename)) {
            img.uri = expectedUri;
          } else {
            console.warn("[ImageContext] File missing for image:", img.id);

            if (img.base64Data && img.base64Data.length > 100 && file) {
              try {
                console.log(
                  "[ImageContext] Restoring file from base64 for:",
                  img.id,
                );
                await file.create({ overwrite: true, intermediates: true });
                const bytes = base64ToUint8Array(img.base64Data);
                await file.write(bytes);
                img.uri = file.uri;
              } catch (err) {
                console.error("[ImageContext] Failed to restore file:", err);
                img.uri = "";
              }
            } else {
              img.uri = "";
            }
          }
          return img;
        }),
      );

      console.log("[ImageContext] Loaded", validImages.length, "images");
      return validImages as GeneratedImage[];
    },
  });

  const saveImagesMutation = useMutation({
    mutationFn: async (images: GeneratedImage[]) => {
      const trimmed = images.slice(0, MAX_STORED_IMAGES);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["generated-images"], data);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const size = ASPECT_RATIO_MAP[selectedAspectRatio];

      let result:
        | { image: { base64Data: string; mimeType: string }; size: string }
        | undefined;
      let localUri = "";
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (Platform.OS === "ios" && ExpoStableDiffusion) {
        console.log("[ImageContext] Generating image locally with Core ML");
        await ensureDirExists();

        const savePath = `${imagesDir?.uri ?? FileSystem.documentDirectory ?? ""}${imageId}.jpeg`;

        try {
          await ensureModelAvailable();
          if (!isModelLoaded) {
            await ExpoStableDiffusion.loadModel(MODEL_DIR);
            isModelLoaded = true;
          }
          await ExpoStableDiffusion.generateImage({
            prompt: prompt,
            stepCount: 25,
            savePath: savePath,
          });

          localUri = savePath;
          const base64Data = await FileSystem.readAsStringAsync(savePath, {
            encoding: "base64" as any,
          });

          result = {
            image: {
              base64Data,
              mimeType: "image/jpeg",
            },
            size,
          };
        } catch (error) {
          console.error(
            "[ImageContext] Local generation failed, falling back to API:",
            error,
          );
          localUri = "";
          result = await generateImageAPI(prompt, size);
        }
      } else {
        result = await generateImageAPI(prompt, size);
      }

      if (!result) {
        throw new Error("[ImageContext] Image generation failed");
      }

      await ensureDirExists();

      const newImage: GeneratedImage = {
        id: imageId,
        prompt,
        base64Data: result.image.base64Data,
        uri: localUri,
        mimeType: result.image.mimeType,
        size: result.size,
        createdAt: Date.now(),
      };

      if (!localUri && Platform.OS !== "web" && imagesDir) {
        const extension = getImageExtension(result.image.mimeType);
        const filename = `${newImage.id}.${extension}`;
        const file = new File(imagesDir, filename);

        try {
          await file.create({ overwrite: true, intermediates: true });
          const bytes = base64ToUint8Array(result.image.base64Data);
          await file.write(bytes);

          const fileExists = file.exists;
          const fileSize = file.size;

          if (fileExists) {
            console.log(
              "[ImageContext] Saved image to:",
              file.uri,
              "size:",
              fileSize,
            );

            if (fileSize != null && fileSize < 100) {
              console.error(
                "[ImageContext] File write appeared to succeed but file is missing or empty",
              );
            }
          } else {
            console.error(
              "[ImageContext] File write failed, file does not exist",
            );
          }

          newImage.uri = file.uri;
        } catch (error) {
          console.error(
            "[ImageContext] Failed to save image to file system:",
            error,
          );
          throw error;
        }
      }

      const currentImages = imagesQuery.data || [];
      const updatedImages = [newImage, ...currentImages];
      await saveImagesMutation.mutateAsync(updatedImages);

      return { ...newImage, base64Data: result.image.base64Data };
    },
  });

  const { mutateAsync: saveImagesAsync } = saveImagesMutation;

  const deleteImage = useCallback(
    async (image: GeneratedImage) => {
      console.log("[ImageContext] Deleting image:", image.id);

      if (image.uri && Platform.OS !== "web") {
        try {
          const file = new File(image.uri);
          file.delete();
        } catch (e) {
          console.warn("[ImageContext] Failed to delete file:", e);
        }
      }

      const currentImages = imagesQuery.data || [];
      const updatedImages = currentImages.filter((img) => img.id !== image.id);
      await saveImagesAsync(updatedImages);
    },
    [imagesQuery.data, saveImagesAsync],
  );

  const clearAllImages = useCallback(async () => {
    console.log("[ImageContext] Clearing all images");

    if (Platform.OS !== "web") {
      const currentImages = imagesQuery.data || [];
      for (const img of currentImages) {
        if (img.uri) {
          try {
            const file = new File(img.uri);
            file.delete();
          } catch (e) {
            console.warn("[ImageContext] Failed to delete file:", e);
          }
        }
      }
    }

    await saveImagesAsync([]);
  }, [imagesQuery.data, saveImagesAsync]);

  const images = useMemo(() => imagesQuery.data || [], [imagesQuery.data]);

  return {
    images,
    isLoading: imagesQuery.isLoading,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
    selectedAspectRatio,
    setSelectedAspectRatio,
    generateImage: generateMutation.mutateAsync,
    deleteImage,
    clearAllImages,
    lastGeneratedImage: generateMutation.data,
  };
});
