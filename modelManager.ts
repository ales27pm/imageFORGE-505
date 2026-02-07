export const MODEL_DIR = "";

export function isLocalGenerationAvailable() {
  return false;
}

export async function generateWithStableDiffusion(_args: {
  prompt: string;
  stepCount: number;
  savePath: string;
}) {
  throw new Error("[modelManager] Local generation is not available in this environment");
}

export function initModelOnce() {
  return Promise.resolve();
}

export async function ensureModelAvailableOnce() {
  return;
}

export async function loadModelOnce() {
  return;
}
