import Constants from "expo-constants";

type Extra = Record<string, string> | undefined;

export function getManifestExtra(): Extra {
  const { expoConfig, manifest, manifest2 } = Constants;

  if (expoConfig?.extra) return expoConfig.extra as Extra;

  const legacyManifest = manifest as { extra?: Extra } | null;
  if (legacyManifest?.extra) return legacyManifest.extra;

  const modernManifest = manifest2 as {
    extra?: Extra;
    expoClient?: { extra?: Extra };
  } | null;
  if (modernManifest?.extra) return modernManifest.extra;
  if (modernManifest?.expoClient?.extra) return modernManifest.expoClient.extra;

  return undefined;
}
