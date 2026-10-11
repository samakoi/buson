import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { ListaAlunos, MeusDados, PerfilAlunoAdmin, StatusConta } from "../../types";

/** DOCUMENTO = alunos com documento aguardando análise */
export type FiltroAlunos = "TODOS" | StatusConta | "DOCUMENTO";

const POR_PAGINA = 20;

export const chavesAluno = {
  eu: ["alunos", "me"] as const,
  perfil: (alunoId: string) => ["alunos", "perfil", alunoId] as const,
  lista: (busca: string, filtro: FiltroAlunos) => ["alunos", "lista", busca, filtro] as const,
};

/** Cadastro do aluno logado (status da conta, pendências, documento, universidade). */
export function useMeusDados() {
  return useQuery({ queryKey: chavesAluno.eu, queryFn: async () => (await api.get<MeusDados>("/alunos/me")).data });
}

/** Perfil completo de um aluno, para a administração. */
export function usePerfilAluno(alunoId: string) {
  return useQuery({
    queryKey: chavesAluno.perfil(alunoId),
    queryFn: async () => (await api.get<PerfilAlunoAdmin>(`/alunos/${alunoId}`)).data,
  });
}

/** Lista de alunos com busca, filtro e páginas de 20 ("carregar mais"). */
export function useListaAlunos(busca: string, filtro: FiltroAlunos) {
  return useInfiniteQuery({
    queryKey: chavesAluno.lista(busca, filtro),
    queryFn: async ({ pageParam }) =>
      (
        await api.get<ListaAlunos>("/alunos", {
          params: {
            busca: busca || undefined,
            status: filtro === "TODOS" || filtro === "DOCUMENTO" ? undefined : filtro,
            documentoPendente: filtro === "DOCUMENTO" ? true : undefined,
            pagina: pageParam,
            porPagina: POR_PAGINA,
          },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (ultima, todas) => (todas.reduce((n, p) => n + p.itens.length, 0) < ultima.total ? ultima.pagina + 1 : undefined),
    // Ao trocar a busca ou o filtro, a lista anterior continua na tela até a nova chegar
    placeholderData: keepPreviousData,
  });
}
