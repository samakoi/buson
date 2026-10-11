import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Checkin, Onibus, RotaDoDia, Viagem } from "../../types";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";

export const chavesViagem = {
  atual: ["viagens", "atual"] as const,
  rota: (viagemId?: string) => ["viagens", viagemId, "rota"] as const,
  passageiros: (viagemId?: string) => ["viagens", viagemId, "passageiros"] as const,
  lista: (desde: string) => ["viagens", "lista", desde] as const,
  frota: ["onibus", "status"] as const,
};

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
