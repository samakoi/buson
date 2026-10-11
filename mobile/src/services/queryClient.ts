import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { AxiosError } from "axios";

/**
 * Cache dos dados da API (TanStack Query). Erros 4xx não são repetidos
 * (são respostas definitivas, ex.: sem permissão); falhas de rede tentam de novo.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (tentativas, erro) => {
        const status = (erro as AxiosError)?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return tentativas < 2;
      },
    },
    mutations: { retry: false },
  },
});

// No celular, "voltar para o app" conta como foco: o React Query atualiza o que estiver velho
// (no navegador ele já percebe a troca de aba sozinho)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (estado) => focusManager.setFocused(estado === "active"));
}
