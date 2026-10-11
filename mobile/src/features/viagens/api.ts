import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Checkin, DetalheViagem, HistoricoViagens, Onibus, RotaDoDia, SentidoViagem, StatusViagem, Viagem } from "../../types";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";

export const chavesViagem = {
  atual: ["viagens", "atual"] as const,
  rota: (viagemId?: string) => ["viagens", viagemId, "rota"] as const,
  passageiros: (viagemId?: string) => ["viagens", viagemId, "passageiros"] as const,
  lista: (desde: string) => ["viagens", "lista", desde] as const,
  frota: ["onibus", "status"] as const,
  historico: (f: FiltroHistorico) => ["viagens", "historico", f] as const,
  detalhe: (viagemId: string) => ["viagens", viagemId, "detalhe"] as const,
};

/** Filtros do histórico de viagens (administração). */
export interface FiltroHistorico {
  inicio: string;
  fim: string;
  rotaId?: string;
  motoristaId?: string;
  sentido?: SentidoViagem;
  status?: StatusViagem;
}

/** Situação da frota (ônibus em manutenção), para o aluno. */
export type StatusFrota = Pick<Onibus, "id" | "placa" | "emManutencao" | "observacaoManutencao">;

/** Viagem do dia do usuário logado (aluno ou motorista). */
export function useViagemAtual(opcoes: { atualizarACada?: number } = {}) {
  return useQuery({
    queryKey: chavesViagem.atual,
    queryFn: async () => (await api.get<Viagem | null>("/viagens/atual")).data,
    refetchInterval: opcoes.atualizarACada,
  });
}

/**
 * Encerrar a viagem (motorista), com a confirmação que avisa quantos alunos
 * confirmados ainda não embarcaram e serão registrados como falta.
 */
export function useEncerrarViagem(aoConcluir?: () => void) {
  const cliente = useQueryClient();
  const mutacao = useMutation({
    mutationFn: (viagemId: string) => api.post(`/viagens/${viagemId}/encerrar`),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesViagem.atual });
      aoConcluir?.();
    },
    onError: (err) => avisar("Não foi possível encerrar", mensagemDeErro(err, "Tente novamente.")),
  });

  async function encerrar(viagem: Viagem) {
    // Com vaga = confirmados + programados (dia fixo que não confirmou)
    const faltando = viagem.resumo.ocupados - viagem.resumo.embarcados;
    const ok = await confirmar(
      "Encerrar viagem",
      faltando > 0
        ? `${faltando} aluno(s) com vaga ainda não embarcaram e serão registrados como falta. Deseja encerrar mesmo assim?`
        : "Todos os alunos com vaga embarcaram. Deseja encerrar a viagem?",
      { textoConfirmar: "Encerrar", destrutivo: faltando > 0 }
    );
    if (ok) mutacao.mutate(viagem.id);
  }

  return { encerrar, encerrando: mutacao.isPending };
}

/** Paradas do dia da viagem (com quantos alunos em cada); desligada sem viagem. */
export function useRotaDoDia(viagemId: string | undefined) {
  return useQuery({
    queryKey: chavesViagem.rota(viagemId),
    queryFn: async () => (await api.get<RotaDoDia>(`/viagens/${viagemId}/rota`)).data,
    enabled: !!viagemId,
  });
}

/** Passageiros da viagem (motorista); desligada sem viagem. */
export function usePassageiros(viagemId: string | undefined) {
  return useQuery({
    queryKey: chavesViagem.passageiros(viagemId),
    queryFn: async () => (await api.get<Checkin[]>(`/viagens/${viagemId}/passageiros`)).data,
    enabled: !!viagemId,
  });
}

/** Viagens a partir de uma data (administração). */
export function useViagensDesde(desde: string) {
  return useQuery({
    queryKey: chavesViagem.lista(desde),
    queryFn: async () => (await api.get<Viagem[]>("/viagens", { params: { desde } })).data,
  });
}

export function useFrota() {
  return useQuery({ queryKey: chavesViagem.frota, queryFn: async () => (await api.get<StatusFrota[]>("/onibus/status")).data });
}

/** Histórico de viagens, mais recentes primeiro, em páginas de 20 ("carregar mais"). */
export function useHistoricoViagens(filtro: FiltroHistorico) {
  return useInfiniteQuery({
    queryKey: chavesViagem.historico(filtro),
    queryFn: async ({ pageParam }) =>
      (await api.get<HistoricoViagens>("/viagens/historico", { params: { ...filtro, pagina: pageParam, porPagina: 20 } })).data,
    initialPageParam: 1,
    getNextPageParam: (ultima, todas) => (todas.reduce((n, p) => n + p.itens.length, 0) < ultima.total ? ultima.pagina + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

/** Detalhe de uma viagem (horários, números e passageiros). */
export function useDetalheViagem(viagemId: string) {
  return useQuery({
    queryKey: chavesViagem.detalhe(viagemId),
    queryFn: async () => (await api.get<DetalheViagem>(`/viagens/${viagemId}/detalhe`)).data,
  });
}
