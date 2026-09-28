import { QueryClient } from "@tanstack/react-query";
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
