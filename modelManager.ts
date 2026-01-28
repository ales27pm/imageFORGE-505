import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { getManifestExtra } from "@/utils/manifestExtra";
import { unzipFileWithFflate } from "@/utils/unzip";

let ExpoStableDiffusion: any;
type Unzipper = (source: string, destination: string) => Promise<void>;
let unzipArchive: Unzipper | null = null;

function getUnzipArchive() {
  if (Platform.OS !== "ios") {
    return null;
  }
  if (!unzipArchive) {
    try {
      const { unzip } = require("react-native-zip-archive");
      unzipArchive = async (source: string, destination: string) => {
        await unzip(source, destination);
      };
    } catch (e) {
      console.warn(
        "[modelManager] react-native-zip-archive not available, using JS unzip",
      );
      unzipArchive = unzipFileWithFflate;
    }
  }
  return unzipArchive;
}

function getExpoStableDiffusion() {
  if (Platform.OS !== "ios") {
    return null;
  }
  if (!ExpoStableDiffusion) {
    try {
      ExpoStableDiffusion = require("expo-stable-diffusion");
    } catch (e) {
      console.warn("[modelManager] expo-stable-diffusion not available");
      return null;
    }
  }
  return ExpoStableDiffusion;
}

const MODEL_PARENT_DIR = (FileSystem.documentDirectory || "") + "Model/";
export const MODEL_DIR = `${MODEL_PARENT_DIR}stable-diffusion-2-1/`;
const MODEL_ZIP_PATH = `${MODEL_PARENT_DIR}stable-diffusion-2-1.zip`;
const DEFAULT_MODEL_ZIP_URL =
  "https://huggingface.co/andrei-zgirvaci/coreml-stable-diffusion-2-1-split-einsum-v2-txt2img/resolve/main/coreml-stable-diffusion-2-1-split-einsum-v2-cpu-and-ne-txt2img.zip";

const manifestExtra = getManifestExtra();
const MODEL_ZIP_URL =
  manifestExtra?.stableDiffusionModelZipUrl ?? DEFAULT_MODEL_ZIP_URL;

let modelInitPromise: Promise<void> | null = null;

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
  const stableDiffusion = getExpoStableDiffusion();
  if (Platform.OS !== "ios" || !stableDiffusion) {
    return;
  }
  const unzip = getUnzipArchive();
  if (!unzip) {
    throw new Error("[modelManager] Zip archive support not available");
  }
  await FileSystem.makeDirectoryAsync(MODEL_PARENT_DIR, {
    intermediates: true,
  });
  const modelInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (modelInfo.exists && modelInfo.isDirectory) {
    return;
  }

  console.log("[modelManager] Downloading Core ML model to device...");
  try {
    await FileSystem.downloadAsync(MODEL_ZIP_URL, MODEL_ZIP_PATH);
  } catch (error) {
    console.error(
      "[modelManager] Failed to download Core ML model zip:",
      error,
    );
    throw error;
  }

  console.log("[modelManager] Unzipping Core ML model...");
  try {
    await unzip(MODEL_ZIP_PATH, MODEL_PARENT_DIR);
    await FileSystem.deleteAsync(MODEL_ZIP_PATH, { idempotent: true });
  } catch (error) {
    console.error("[modelManager] Failed to unzip Core ML model:", error);
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

  throw new Error("[modelManager] Model extraction failed.");
}

async function initModel() {
  const stableDiffusion = getExpoStableDiffusion();
  if (Platform.OS !== "ios" || !stableDiffusion) {
    return;
  }
  await ensureModelAvailable();
  await stableDiffusion.loadModel(MODEL_DIR);
}

export function initModelOnce() {
  if (!modelInitPromise) {
    modelInitPromise = initModel().catch((error: unknown) => {
      modelInitPromise = null;
      throw error;
    });
  }
  return modelInitPromise;
}

export async function ensureModelAvailableOnce() {
  await initModelOnce();
}

export async function loadModelOnce() {
  await initModelOnce();
}

export function isLocalGenerationAvailable() {
  return !!getExpoStableDiffusion();
}

export async function generateWithStableDiffusion(args: {
  prompt: string;
  stepCount: number;
  savePath: string;
}) {
  await initModelOnce();
  const stableDiffusion = getExpoStableDiffusion();
  if (!stableDiffusion) {
    throw new Error("[modelManager] Stable Diffusion not available");
  }
  return stableDiffusion.generateImage(args);
}
