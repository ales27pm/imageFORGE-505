import * as FileSystem from "expo-file-system";
import {
  generateWithStableDiffusion,
  isLocalGenerationAvailable,
} from "@/modelManager";

export type GeneratedPayload = {
  image: { base64Data: string; mimeType: string };
  size: string;
  localUri?: string;
};

async function generateImageAPI(
  prompt: string,
  size: string,
): Promise<GeneratedPayload> {
  const response = await fetch("https://toolkit.rork.com/images/generate/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, size }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[imageGeneration] Generation failed:", errorText);
    throw new Error("Failed to generate image");
  }

  const data = await response.json();
  console.log("[imageGeneration] Image generated successfully");
  console.log("[imageGeneration] Data mimeType:", data.image.mimeType);
  console.log(
    "[imageGeneration] Base64 length:",
    data.image.base64Data?.length,
  );

  if (data.image?.base64Data) {
    let b64 = data.image.base64Data.replace(/[\r\n\s]+/g, "");

    if (b64.startsWith("data:")) {
      const commaIndex = b64.indexOf(",");
      if (commaIndex !== -1) {
        b64 = b64.substring(commaIndex + 1);
      }
    }

    console.log("[imageGeneration] Base64 processed length:", b64.length);
    console.log("[imageGeneration] Base64 prefix:", b64.substring(0, 50));

    data.image.base64Data = b64;
  }

  if (!data.image.mimeType) {
    data.image.mimeType = "image/png";
  }

  return data;
}

export async function generateLocally(
  prompt: string,
  size: string,
  savePath: string,
): Promise<GeneratedPayload> {
  if (!isLocalGenerationAvailable()) {
    throw new Error("[imageGeneration] Stable Diffusion not available");
  }
  await generateWithStableDiffusion({
    prompt,
    stepCount: 25,
    savePath,
  });
  const base64Data = await FileSystem.readAsStringAsync(savePath, {
    encoding: "base64" as any,
  });
  return {
    image: { base64Data, mimeType: "image/jpeg" },
    size,
    localUri: savePath,
  };
}

export async function generateViaApi(
  prompt: string,
  size: string,
): Promise<GeneratedPayload> {
  const result = await generateImageAPI(prompt, size);
  return { ...result, localUri: undefined };
}
