import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { GeneratedImage, AspectRatio, ASPECT_RATIO_MAP } from "@/types/image";
import { File, Directory, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system";
import { buildImagePath } from "@/utils/imageUtils";
import {
  ensureImagesDirExists,
  hydrateStoredImages,
  persistImageToFileSystem,
} from "@/utils/imageStorage";
import {
  generateLocally,
  generateViaApi,
  GeneratedPayload,
} from "@/utils/imageGeneration";
import { isLocalGenerationAvailable } from "@/modelManager";

const STORAGE_KEY = "ai_forge_images";
const MAX_STORED_IMAGES = 10;
const imagesDir =
  Platform.OS !== "web" ? new Directory(Paths.document, "images") : null;

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

      await ensureImagesDirExists(imagesDir);
      const hydrated = await hydrateStoredImages(images, imagesDir);
      console.log("[ImageContext] Loaded", hydrated.length, "images");
      return hydrated as GeneratedImage[];
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

      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let payload: GeneratedPayload;

      if (Platform.OS === "ios" && isLocalGenerationAvailable()) {
        console.log("[ImageContext] Generating image locally with Core ML");
        await ensureImagesDirExists(imagesDir);
        const savePath = buildImagePath(
          imagesDir?.uri ?? FileSystem.documentDirectory ?? "",
          imageId,
          "image/jpeg",
        );

        try {
          payload = await generateLocally(prompt, size, savePath);
        } catch (error) {
          console.error(
            "[ImageContext] Local generation failed, falling back to API:",
            error,
          );
          payload = await generateViaApi(prompt, size);
        }
      } else {
        payload = await generateViaApi(prompt, size);
      }

      await ensureImagesDirExists(imagesDir);

      const newImage: GeneratedImage = {
        id: imageId,
        prompt,
        base64Data: payload.image.base64Data,
        uri: payload.localUri ?? "",
        mimeType: payload.image.mimeType,
        size: payload.size,
        createdAt: Date.now(),
      };

      const persistedImage =
        payload.localUri || Platform.OS === "web"
          ? newImage
          : await persistImageToFileSystem(newImage, imagesDir);

      const currentImages = imagesQuery.data || [];
      const updatedImages = [persistedImage, ...currentImages];
      await saveImagesMutation.mutateAsync(updatedImages);

      return { ...persistedImage, base64Data: payload.image.base64Data };
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
