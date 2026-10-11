import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Onde ficam os tokens da sessão:
 *  - Android/iOS: SecureStore (criptografado pelo Keystore/Keychain, fora do backup do Android)
 *  - Web: localStorage (via AsyncStorage); o navegador não tem um cofre equivalente
 * Versões antigas do app guardavam os tokens no AsyncStorage: na primeira leitura eles são
 * movidos para o SecureStore, sem pedir login de novo.
 */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Chaves no AsyncStorage (web e versões antigas do app) */
const CHAVES_ANTIGAS = { accessToken: "@busOn:accessToken", refreshToken: "@busOn:refreshToken" } as const;
/** Chaves no SecureStore (só aceita letras, números, ".", "-" e "_") */
const CHAVES_SEGURAS = { accessToken: "busOn.accessToken", refreshToken: "busOn.refreshToken" } as const;

const nativo = Platform.OS !== "web";
// Depois do primeiro desbloqueio: o rastreamento de GPS em segundo plano renova a sessão com a tela bloqueada
const opcoes: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

// Cópia em memória (só no nativo): o interceptor lê o token a cada requisição. No web não há cópia,
// porque várias abas dividem o localStorage e uma delas pode ter renovado (trocado) os tokens.
let emMemoria: Partial<Tokens> | null = null;
let carregamento: Promise<Partial<Tokens>> | null = null;

async function carregarNativo(): Promise<Partial<Tokens>> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(CHAVES_SEGURAS.accessToken, opcoes),
    SecureStore.getItemAsync(CHAVES_SEGURAS.refreshToken, opcoes),
  ]);
  if (refreshToken) return { accessToken: accessToken ?? undefined, refreshToken };

  // Migração única do AsyncStorage
  const antigos = Object.fromEntries(await AsyncStorage.multiGet(Object.values(CHAVES_ANTIGAS)));
  const migrados = { accessToken: antigos[CHAVES_ANTIGAS.accessToken], refreshToken: antigos[CHAVES_ANTIGAS.refreshToken] };
  if (migrados.accessToken && migrados.refreshToken) {
    await salvarNativo(migrados as Tokens);
    await AsyncStorage.multiRemove(Object.values(CHAVES_ANTIGAS));
    return migrados as Tokens;
  }
  return {};
}

async function salvarNativo(t: Tokens) {
  await Promise.all([
    SecureStore.setItemAsync(CHAVES_SEGURAS.accessToken, t.accessToken, opcoes),
    SecureStore.setItemAsync(CHAVES_SEGURAS.refreshToken, t.refreshToken, opcoes),
  ]);
}

async function carregarWeb(): Promise<Partial<Tokens>> {
  const [accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(CHAVES_ANTIGAS.accessToken),
    AsyncStorage.getItem(CHAVES_ANTIGAS.refreshToken),
  ]);
  return { accessToken: accessToken ?? undefined, refreshToken: refreshToken ?? undefined };
}

async function carregar(): Promise<Partial<Tokens>> {
  if (!nativo) return carregarWeb();
  if (emMemoria) return emMemoria;
  carregamento ??= carregarNativo()
    // Se salvarTokens/apagarTokens rodou enquanto lia, vale o que eles gravaram
    .then((t) => (emMemoria ??= t))
    .finally(() => {
      carregamento = null;
    });
  return carregamento;
}

export async function lerToken(tipo: keyof Tokens): Promise<string | null> {
  return (await carregar())[tipo] ?? null;
}

export async function salvarTokens(t: Tokens) {
  if (nativo) {
    emMemoria = { ...t };
    await salvarNativo(t);
  } else
    await AsyncStorage.multiSet([
      [CHAVES_ANTIGAS.accessToken, t.accessToken],
      [CHAVES_ANTIGAS.refreshToken, t.refreshToken],
    ]);
}

export async function apagarTokens() {
  if (nativo) emMemoria = {};
  await AsyncStorage.multiRemove(Object.values(CHAVES_ANTIGAS));
  if (nativo) {
    await Promise.all([
      SecureStore.deleteItemAsync(CHAVES_SEGURAS.accessToken, opcoes),
      SecureStore.deleteItemAsync(CHAVES_SEGURAS.refreshToken, opcoes),
    ]);
  }
}
