import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { unzip } from "react-native-zip-archive";
import Constants from "expo-constants";

let ExpoStableDiffusion: any;
if (Platform.OS === "ios") {
  try {
    ExpoStableDiffusion = require("expo-stable-diffusion");
  } catch (e) {
    console.warn("[modelManager] expo-stable-diffusion not available");
  }
}

const MODEL_PARENT_DIR = (FileSystem.documentDirectory || "") + "Model/";
export const MODEL_DIR = `${MODEL_PARENT_DIR}stable-diffusion-2-1/`;
const MODEL_ZIP_PATH = `${MODEL_PARENT_DIR}stable-diffusion-2-1.zip`;
const DEFAULT_MODEL_ZIP_URL =
  "https://huggingface.co/andrei-zgirvaci/coreml-stable-diffusion-2-1-split-einsum-v2-txt2img/resolve/main/coreml-stable-diffusion-2-1-split-einsum-v2-cpu-and-ne-txt2img.zip";

const manifestExtra =
  Constants.expoConfig?.extra ??
  (Constants.manifest as { extra?: Record<string, string> } | null)?.extra ??
  (Constants.manifest2 as { extra?: Record<string, string> } | null)?.extra ??
  (
    Constants.manifest2 as {
      expoClient?: { extra?: Record<string, string> };
    } | null
  )?.expoClient?.extra ??
  null;

const MODEL_ZIP_URL =
  manifestExtra?.stableDiffusionModelZipUrl ?? DEFAULT_MODEL_ZIP_URL;

let modelEnsurePromise: Promise<void> | null = null;
let modelLoadPromise: Promise<void> | null = null;
let isModelEnsured = false;

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
    isModelEnsured = true;
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
    isModelEnsured = true;
    return;
  }

  const candidate = await findModelCandidate(MODEL_PARENT_DIR);
  if (candidate) {
    await FileSystem.moveAsync({ from: candidate, to: MODEL_DIR });
    isModelEnsured = true;
    return;
  }

  throw new Error("[modelManager] Model extraction failed.");
}

export async function ensureModelAvailableOnce() {
  if (isModelEnsured) {
    return;
  }
  if (!modelEnsurePromise) {
    modelEnsurePromise = ensureModelAvailable()
      .then(() => {
        isModelEnsured = true;
      })
      .finally(() => {
        modelEnsurePromise = null;
      });
  }
  return modelEnsurePromise;
}

export async function loadModelOnce() {
  if (Platform.OS !== "ios" || !ExpoStableDiffusion) {
    return;
  }
  await ensureModelAvailableOnce();
  if (!modelLoadPromise) {
    modelLoadPromise = ExpoStableDiffusion.loadModel(MODEL_DIR).catch(
      (error: unknown) => {
        modelLoadPromise = null;
        throw error;
      },
    );
  }
  return modelLoadPromise;
}

export { ExpoStableDiffusion };
