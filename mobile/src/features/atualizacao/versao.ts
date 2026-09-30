import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Versão do app e atualizações pela internet (EAS Update).
 * - O APK procura atualização ao abrir; a que chegar vale na próxima abertura.
 * - Ao voltar para o app, baixa em segundo plano (quem nunca fecha o app também recebe).
 * No Expo Go e no navegador as atualizações ficam desligadas (Updates.isEnabled = false).
 */

// No navegador o módulo existe, mas não há atualizações pela internet
const atualizacoesAtivas = Platform.OS !== "web" && Updates.isEnabled;

const AMBIENTE = process.env.EXPO_PUBLIC_AMBIENTE ?? (__DEV__ ? "desenvolvimento" : "production");

export function infoDaVersao() {
  const versao = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "dev";
  const build = Application.nativeBuildVersion;
  const atualizacao = atualizacoesAtivas && !Updates.isEmbeddedLaunch && Updates.updateId ? Updates.updateId.slice(0, 8) : null;
  const ambiente = AMBIENTE === "production" ? "produção" : AMBIENTE;
  return {
    /** versionCode do APK (compara com a versão mínima da API); null fora do Android */
    build: build ? Number(build) : null,
    texto: `${versao}${build ? ` (build ${build})` : ""} · ${ambiente}${atualizacao ? ` · atualização ${atualizacao}` : ""}`,
  };
}

let baixando = false;

/** Baixa uma atualização, se houver, para valer na próxima abertura. Nunca lança erro. */
export async function baixarAtualizacaoEmSegundoPlano() {
  if (!atualizacoesAtivas || baixando) return;
  baixando = true;
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // sem internet ou servidor fora: tenta de novo na próxima vez
  } finally {
    baixando = false;
  }
}

/** Botão "Procurar atualização": baixa e reinicia o app na hora. */
export async function procurarEAplicarAtualizacao(): Promise<"indisponivel" | "atualizado" | "sem-novidade"> {
  if (!atualizacoesAtivas) return "indisponivel";
  const { isAvailable } = await Updates.checkForUpdateAsync();
  if (!isAvailable) return "sem-novidade";
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
  return "atualizado";
}
