import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { DiasDoAluno, OcupacaoSemanal, PontoEmbarque, Programacao } from "../../types";
import { chavesViagem } from "../viagens/api";

export const chavesAlocacao = {
  dias: (alunoId?: string) => ["dias", alunoId ?? "eu"] as const,
  pontos: (todos: boolean) => ["pontos-embarque", todos ? "todos" : "ativos"] as const,
  programacoes: ["programacoes"] as const,
  ocupacaoSemanal: ["dashboard", "ocupacao-semanal"] as const,
};

const caminhoDias = (alunoId?: string) => (alunoId ? `/alunos/${alunoId}/dias` : "/alunos/me/dias");

// ---- Dias do aluno (o próprio aluno ou o admin, informando alunoId)

export function useDias(alunoId?: string) {
  return useQuery({
    queryKey: chavesAlocacao.dias(alunoId),
    queryFn: async () => (await api.get<DiasDoAluno>(caminhoDias(alunoId))).data,
  });
}

export interface DiaEscolhido {
  diaSemana: number;
  rotaId: string;
  pontoEmbarqueId: string | null;
}

export function useSalvarDias(alunoId?: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (dias: DiaEscolhido[]) => (await api.put<DiasDoAluno>(caminhoDias(alunoId), { dias })).data,
    onSuccess: (dados) => {
      cliente.setQueryData(chavesAlocacao.dias(alunoId), dados);
      cliente.invalidateQueries({ queryKey: chavesViagem.atual });
      cliente.invalidateQueries({ queryKey: chavesAlocacao.programacoes });
      cliente.invalidateQueries({ queryKey: chavesAlocacao.ocupacaoSemanal });
    },
    // Dia lotado enquanto a tela estava aberta: busca as vagas de novo
    onError: () => cliente.invalidateQueries({ queryKey: chavesAlocacao.dias(alunoId) }),
  });
}

// ---- Pontos de embarque (admin)

export function usePontosEmbarque(todos = false) {
  return useQuery({
    queryKey: chavesAlocacao.pontos(todos),
    queryFn: async () => (await api.get<PontoEmbarque[]>("/pontos-embarque", { params: todos ? { todos: true } : undefined })).data,
  });
}

export function useSalvarPonto() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dados
    }: {
      id?: string;
      nome?: string;
      endereco?: string | null;
      ativo?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    }) =>
      id ? (await api.patch(`/pontos-embarque/${id}`, dados)).data : (await api.post("/pontos-embarque", dados)).data,
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["pontos-embarque"] }),
  });
}

export function useExcluirPonto() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pontos-embarque/${id}`),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["pontos-embarque"] }),
  });
}

// ---- Programação semanal (admin)

export function useProgramacoes() {
  return useQuery({
    queryKey: chavesAlocacao.programacoes,
    queryFn: async () => (await api.get<Programacao[]>("/programacoes")).data,
  });
}

export interface DadosProgramacao {
  rotaId: string;
  onibusId: string;
  motoristaId: string;
  horarioIda: string;
  horarioVolta: string | null;
  diasSemana: number[];
  ativa?: boolean;
}

/** Cria (sem id) ou altera (com id) uma programação. As viagens futuras são ajustadas pela API. */
export function useSalvarProgramacao(aoConcluir?: () => void) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id?: string; dados: Partial<DadosProgramacao> }) => {
      if (id) {
        const { rotaId: _rota, ...mudancas } = dados; // a rota de uma programação não muda
        return (await api.patch<Programacao>(`/programacoes/${id}`, mudancas)).data;
      }
      return (await api.post<Programacao>("/programacoes", dados)).data;
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesAlocacao.programacoes });
      cliente.invalidateQueries({ queryKey: chavesAlocacao.ocupacaoSemanal });
      aoConcluir?.();
    },
  });
}

export function useExcluirProgramacao() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/programacoes/${id}`),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesAlocacao.programacoes });
      cliente.invalidateQueries({ queryKey: chavesAlocacao.ocupacaoSemanal });
    },
  });
}

export function useGerarViagens() {
  return useMutation({
    mutationFn: async () => (await api.post<{ criadas: number }>("/programacoes/gerar")).data,
  });
}

// ---- Dashboard

export function useOcupacaoSemanal() {
  return useQuery({
    queryKey: chavesAlocacao.ocupacaoSemanal,
    queryFn: async () => (await api.get<OcupacaoSemanal>("/dashboard/ocupacao-semanal")).data,
  });
}
