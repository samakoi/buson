import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * IMPORTANTE:
 * - No emulador Android, "localhost" do seu computador é 10.0.2.2
 * - No Expo Go (celular físico), use o IP da sua máquina na rede local, ex: 192.168.0.10
 * - No simulador iOS e no navegador, "localhost" funciona normalmente
 * Ajuste a constante abaixo conforme o seu ambiente (veja o GUIA_INSTALACAO.md),
 * ou defina EXPO_PUBLIC_API_URL ao iniciar o Expo.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.3.126:3333/api";

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

// Chamado quando não dá para renovar a sessão (o AuthContext registra o logout aqui)
let aoExpirarSessao: (() => void) | null = null;
export function definirAoExpirarSessao(callback: (() => void) | null) {
  aoExpirarSessao = callback;
}

// Várias requisições podem receber 401 ao mesmo tempo: todas esperam a mesma renovação
let renovacaoEmAndamento: Promise<string> | null = null;

async function renovarAccessToken(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new Error("Sem refresh token salvo.");
  // axios "puro", sem os interceptors, para não entrar em loop
  const { data } = await axios.post<{ accessToken: string }>(`${API_URL}/auth/refresh`, { refreshToken });
  await AsyncStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken);
  return data.accessToken;
}

type RequisicaoComRetentativa = InternalAxiosRequestConfig & { _jaRenovou?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RequisicaoComRetentativa | undefined;
    const ehRotaDeAuth = original?.url?.startsWith("/auth/login") || original?.url?.startsWith("/auth/refresh");

    if (error.response?.status !== 401 || !original || original._jaRenovou || ehRotaDeAuth) {
      return Promise.reject(error);
    }

    original._jaRenovou = true;
    try {
      renovacaoEmAndamento ??= renovarAccessToken().finally(() => {
        renovacaoEmAndamento = null;
      });
      const novoToken = await renovacaoEmAndamento;
      original.headers.Authorization = `Bearer ${novoToken}`;
      return api(original);
    } catch {
      // Refresh token inválido/expirado: encerra a sessão
      aoExpirarSessao?.();
      return Promise.reject(error);
    }
  }
);
