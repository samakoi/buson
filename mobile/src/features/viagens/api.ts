import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Viagem } from "../../types";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";

export const chavesViagem = {
  atual: ["viagens", "atual"] as const,
};

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
    const faltando = viagem.resumo.confirmados - viagem.resumo.embarcados;
    const ok = await confirmar(
      "Encerrar viagem",
      faltando > 0
        ? `${faltando} aluno(s) com vaga confirmada ainda não embarcaram e serão registrados como falta. Deseja encerrar mesmo assim?`
        : "Todos os alunos confirmados embarcaram. Deseja encerrar a viagem?",
      { textoConfirmar: "Encerrar", destrutivo: faltando > 0 }
    );
    if (ok) mutacao.mutate(viagem.id);
  }

  return { encerrar, encerrando: mutacao.isPending };
}
