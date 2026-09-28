import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { obterDeviceId } from "./dispositivo";

/**
 * IMPORTANTE:
 * - No emulador Android, "localhost" do seu computador é 10.0.2.2
 * - No Expo Go (celular físico), use o IP da sua máquina na rede local, ex: 192.168.0.10
 * - No simulador iOS e no navegador, "localhost" funciona normalmente
 * Ajuste a constante abaixo conforme o seu ambiente (veja o GUIA_INSTALACAO.md),
 * ou defina EXPO_PUBLIC_API_URL ao iniciar o Expo. A API é versionada: termina em /api/v1.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.3.126:3333/api/v1";

export const STORAGE_KEYS = {
  accessToken: "@busOn:accessToken",
  refreshToken: "@busOn:refreshToken",
  usuario: "@busOn:usuario",
} as const;

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** A API v1 responde { data: ... } no sucesso: as telas recebem só o conteúdo. */
function desembrulhar<T>(corpo: unknown): T {
  return (corpo && typeof corpo === "object" && "data" in corpo ? (corpo as { data: T }).data : corpo) as T;
}

// Chamado quando não dá para renovar a sessão (a sessão do app registra o logout aqui)
let aoExpirarSessao: (() => void) | null = null;
export function definirAoExpirarSessao(callback: (() => void) | null) {
  aoExpirarSessao = callback;
}

// Várias requisições podem receber 401 ao mesmo tempo: todas esperam a mesma renovação
let renovacaoEmAndamento: Promise<string> | null = null;

async function renovarSessao(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new Error("Sem refresh token salvo.");
  // axios "puro", sem os interceptors, para não entrar em loop
  const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken, deviceId: await obterDeviceId() });
  // Rotação: a API devolve um NOVO par; o refresh antigo deixa de valer
  const par = desembrulhar<{ accessToken: string; refreshToken: string }>(data);
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.accessToken, par.accessToken],
    [STORAGE_KEYS.refreshToken, par.refreshToken],
  ]);
  return par.accessToken;
}

type RequisicaoComRetentativa = InternalAxiosRequestConfig & { _jaRenovou?: boolean };

api.interceptors.response.use(
  (response) => {
    response.data = desembrulhar(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as RequisicaoComRetentativa | undefined;
    const ehRotaDeAuth = ["/auth/login", "/auth/refresh", "/auth/logout"].some((r) => original?.url?.startsWith(r));

    if (error.response?.status !== 401 || !original || original._jaRenovou || ehRotaDeAuth) {
      return Promise.reject(error);
    }

    original._jaRenovou = true;
    try {
      renovacaoEmAndamento ??= renovarSessao().finally(() => {
        renovacaoEmAndamento = null;
      });
      const novoToken = await renovacaoEmAndamento;
      original.headers.Authorization = `Bearer ${novoToken}`;
      return api(original);
    } catch {
      // Sessão expirada ou revogada: encerra no app
      aoExpirarSessao?.();
      return Promise.reject(error);
    }
  }
);
