import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, definirAoExpirarSessao, STORAGE_KEYS } from "../services/api";
import { obterDeviceId } from "../services/dispositivo";
import { apagarTokens, lerToken, salvarTokens } from "../services/tokens";
import { Usuario } from "../types";

interface EstadoSessao {
  usuario: Usuario | null;
  carregando: boolean;
  /** Lê a sessão salva no aparelho (chamado uma vez ao abrir o app). */
  iniciar: () => Promise<void>;
  login: (email: string, senha: string) => Promise<void>;
  /** Sai deste aparelho (revoga a sessão no servidor). */
  logout: () => Promise<void>;
  /** Sai de todos os aparelhos da conta. */
  sairDeTodos: () => Promise<void>;
}

async function limparLocal() {
  await Promise.all([AsyncStorage.multiRemove(Object.values(STORAGE_KEYS)), apagarTokens()]);
}

/** Sessão do usuário (estado global com Zustand). */
export const useSessao = create<EstadoSessao>((set) => ({
  usuario: null,
  carregando: true,

  iniciar: async () => {
    const salvo = await AsyncStorage.getItem(STORAGE_KEYS.usuario);
    set({ usuario: salvo ? (JSON.parse(salvo) as Usuario) : null, carregando: false });
  },

  login: async (email, senha) => {
    const { data } = await api.post<{ accessToken: string; refreshToken: string; usuario: Usuario }>("/auth/login", {
      email,
      senha,
      deviceId: await obterDeviceId(),
    });
    await Promise.all([
      salvarTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }),
      AsyncStorage.setItem(STORAGE_KEYS.usuario, JSON.stringify(data.usuario)),
    ]);
    set({ usuario: data.usuario });
  },

  logout: async () => {
    const refreshToken = await lerToken("refreshToken");
    // Mesmo sem internet o app sai; a sessão no servidor expira sozinha depois
    if (refreshToken) await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    await limparLocal();
    set({ usuario: null });
  },

  sairDeTodos: async () => {
    await api.post("/auth/logout-todos");
    await limparLocal();
    set({ usuario: null });
  },
}));

// Se a renovação falhar (sessão expirada/revogada em outro aparelho), sai localmente
definirAoExpirarSessao(() => {
  limparLocal().then(() => useSessao.setState({ usuario: null }));
});
