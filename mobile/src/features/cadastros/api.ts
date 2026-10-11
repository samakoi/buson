import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { ImpactoExclusaoRota, Motorista, Onibus, Rota, Universidade } from "../../types";
import { avisar, confirmar, mensagemDeErro } from "../../utils/feedback";

/** Chaves do cache dos cadastros (as mesmas em todas as telas que usam esses dados). */
export const chavesCadastro = {
  universidades: ["universidades"] as const,
  onibus: ["onibus"] as const,
  motoristas: ["motoristas"] as const,
  rotas: ["rotas"] as const,
};

export function useUniversidades() {
  return useQuery({
    queryKey: chavesCadastro.universidades,
    queryFn: async () => (await api.get<Universidade[]>("/universidades")).data,
  });
}

export function useOnibus() {
  return useQuery({ queryKey: chavesCadastro.onibus, queryFn: async () => (await api.get<Onibus[]>("/onibus")).data });
}

export function useMotoristas() {
  return useQuery({ queryKey: chavesCadastro.motoristas, queryFn: async () => (await api.get<Motorista[]>("/motoristas")).data });
}

export function useRotas() {
  return useQuery({ queryKey: chavesCadastro.rotas, queryFn: async () => (await api.get<Rota[]>("/rotas")).data });
}

// ---- Rotas com ida e volta

/** Um trecho como a API recebe (paradas em ordem). */
export interface DadosTrecho {
  origem: string;
  destino: string;
  /** IDA: instituições onde os alunos descem; VOLTA: onde embarcam */
  universidadeIds: string[];
  /** IDA: pontos onde os alunos embarcam; VOLTA: onde descem */
  pontosEmbarqueIds: string[];
}

export interface DadosRota {
  nome?: string;
  ida: DadosTrecho;
  volta: DadosTrecho;
}

/** Cria (sem id) ou edita (com id) a rota. `versao` evita sobrescrever a edição de outra pessoa. */
export function useSalvarRota() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados, versao }: { id?: string; dados: DadosRota; versao?: string }) =>
      id ? (await api.patch<Rota>(`/rotas/${id}`, { ...dados, versao })).data : (await api.post<Rota>("/rotas", dados)).data,
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesCadastro.rotas });
      cliente.invalidateQueries({ queryKey: ["programacoes"] });
    },
  });
}

function textoDoImpacto(i: ImpactoExclusaoRota) {
  const partes = [
    i.alunosComDiasFixos && `${i.alunosComDiasFixos} aluno(s) com dias fixos`,
    i.viagensFuturas && `${i.viagensFuturas} viagem(ns) futura(s)`,
    i.reservasFuturas && `${i.reservasFuturas} reserva(s) nessas viagens`,
  ].filter(Boolean);
  return (
    (partes.length ? `Esta rota tem ${partes.join(", ")}. ` : "") +
    "A exclusão cancela as viagens que ainda não começaram (os alunos são avisados), encerra a programação e libera os dias fixos para os alunos escolherem outra viagem.\n\n" +
    (i.viagensNoHistorico ? `As ${i.viagensNoHistorico} viagem(ns) já feitas, com presenças e faltas, continuam no histórico. ` : "") +
    "Instituições, pontos de embarque e alunos não são apagados.\n\nDeseja continuar?"
  );
}

/**
 * Exclusão da rota: busca o impacto, pede a confirmação mostrando o que será afetado e exclui.
 * O backend também exige a confirmação quando há vínculos (não depende só da tela).
 */
export function useExcluirRota() {
  const cliente = useQueryClient();
  const [excluindo, setExcluindo] = useState(false);

  async function excluir(rota: { id: string; nome: string }): Promise<boolean> {
    setExcluindo(true);
    try {
      const impacto = (await api.get<ImpactoExclusaoRota>(`/rotas/${rota.id}/impacto-exclusao`)).data;
      if (impacto.viagensEmAndamento > 0) {
        avisar("Não dá para excluir agora", "Há uma viagem desta rota em andamento. Exclua depois que o motorista encerrar a viagem.");
        return false;
      }
      const ok = await confirmar(
        "Excluir esta rota?",
        impacto.temVinculos ? textoDoImpacto(impacto) : `A rota ${rota.nome} deixa de aparecer nas listas e nas escolhas dos alunos.`,
        { textoConfirmar: "Excluir rota", destrutivo: true }
      );
      if (!ok) return false;
      const resultado = (
        await api.delete<{ viagensCanceladas: number; alunosAvisados: number }>(`/rotas/${rota.id}`, {
          params: impacto.temVinculos ? { confirmarVinculos: "true" } : undefined,
        })
      ).data;
      for (const chave of [chavesCadastro.rotas, ["programacoes"], ["viagens"], ["dias"], ["dashboard"]]) {
        cliente.invalidateQueries({ queryKey: chave });
      }
      avisar(
        "Rota excluída",
        resultado.viagensCanceladas || resultado.alunosAvisados
          ? `${resultado.viagensCanceladas} viagem(ns) cancelada(s) e ${resultado.alunosAvisados} aluno(s) avisado(s).`
          : `${rota.nome} não aparece mais nas listas.`
      );
      return true;
    } catch (err) {
      avisar("Não foi possível excluir", mensagemDeErro(err, "Tente novamente."));
      return false;
    } finally {
      setExcluindo(false);
    }
  }

  return { excluir, excluindo };
}
