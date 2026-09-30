import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Configuração do app por variante (a base fica no app.json):
 *   APP_VARIANT=staging  → "Bus On Teste" (com.buson.app.staging), fala com api-staging.onbus.online
 *   (padrão)             → "Bus On" (com.buson.app), fala com api.onbus.online
 * As duas variantes podem ficar instaladas lado a lado no mesmo celular.
 * Os valores de cada build ficam nos perfis do eas.json.
 */

const variante = process.env.APP_VARIANT === "staging" ? "staging" : "producao";
const ehStaging = variante === "staging";

// google-services.json (Firebase/push): no EAS vem da variável de arquivo GOOGLE_SERVICES_JSON
// (o arquivo nunca vai para o git: o repositório é público). Para um build local, defina
// GOOGLE_SERVICES_JSON=./google-services.json.
const googleServices = process.env.GOOGLE_SERVICES_JSON || undefined;

// Um APK nunca sai sem o endereço https da API (sem isso o app cairia no IP da rede local)
if (
  process.env.EAS_BUILD === "true" &&
  process.env.EAS_BUILD_PROFILE !== "development"
) {
  const url = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (!/^https:\/\/[^/]+\/api\/v1$/.test(url)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL inválida para o build "${process.env.EAS_BUILD_PROFILE}": "${url}" (use https://.../api/v1)`,
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  // Projeto no EAS (gravado no app.json pelo "eas init"; não é segredo)
  const projectId: string | undefined = config.extra?.eas?.projectId;
  return {
    ...config,
    name: ehStaging ? "Bus On Teste" : "Bus On",
    slug: config.slug ?? "bus-on",
    ios: {
      ...config.ios,
      bundleIdentifier: ehStaging ? "com.buson.app.staging" : "com.buson.app",
    },
    android: {
      ...config.android,
      package: ehStaging ? "com.buson.app.staging" : "com.buson.app",
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
      // Ícone com fundo laranja no app de teste, para não confundir com o oficial
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        backgroundColor: ehStaging ? "#C2410C" : "#1E5AA8",
      },
    },
    // Atualizações pela internet (EAS Update): só chegam a APKs com o mesmo código nativo
    runtimeVersion: { policy: "fingerprint" },
    updates: projectId
      ? {
          url: `https://u.expo.dev/${projectId}`,
          checkAutomatically: "ON_LOAD",
          fallbackToCacheTimeout: 0,
        }
      : { enabled: false },
    extra: {
      ...config.extra,
      variante,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
