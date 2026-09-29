import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Falta, FilaFaltas, HistoricoFaltas, MotivoAusencia, SituacaoFalta } from "../../types";
import { abrirPorLink, anexarArquivo, ArquivoEscolhido, opcoesMultipart } from "../documentos/escolherArquivo";
import { diaMes } from "../../utils/datas";

export const chavesFalta = {
  minhas: ["faltas", "minhas"] as const,
  fila: (situacao?: SituacaoFalta, busca?: string) => ["faltas", "fila", situacao ?? "todas", busca ?? ""] as const,
};

/** "ida de 29/09" */
export const descreverViagem = (v: { data: string; sentido: string }) => `${v.sentido === "VOLTA" ? "volta" : "ida"} de ${diaMes(v.data)}`;

/** "Ida de 29/09 • 23:40" — para títulos de lista */
export const tituloViagem = (v: { data: string; sentido: string; horario: string }) =>
  `${v.sentido === "VOLTA" ? "Volta" : "Ida"} de ${diaMes(v.data)} • ${v.horario}`;

export function useMinhasFaltas() {
  return useQuery({
    queryKey: chavesFalta.minhas,
    queryFn: async () => (await api.get<HistoricoFaltas>("/faltas/me")).data,
  });
}

/** Justificativa do aluno: texto + anexo opcional (multipart). */
export function useJustificarFalta() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ faltaId, texto, anexo }: { faltaId: string; texto: string; anexo: ArquivoEscolhido | null }) => {
      const form = new FormData();
      form.append("justificativa", texto);
      if (anexo) await anexarArquivo(form, "anexo", anexo);
      return (await api.post<Falta>(`/faltas/${faltaId}/justificativa`, form, opcoesMultipart)).data;
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesFalta.minhas });
      cliente.invalidateQueries({ queryKey: ["alunos", "me"] });
    },
  });
}

export function abrirAnexoDaFalta(faltaId: string) {
  return abrirPorLink(async () => (await api.post<{ caminho: string }>(`/faltas/${faltaId}/anexo/link`)).data.caminho);
}

/** "Não vou nesta viagem": libera a vaga com motivo (ausência avisada, não é falta). */
export async function liberarVaga(viagemId: string, motivo: Exclude<MotivoAusencia, "FALTOU_NA_IDA"> | undefined, diaTodo: boolean) {
  return (await api.post<{ ok: boolean; liberouIrma: boolean }>(`/viagens/${viagemId}/checkin/cancelar`, { motivo, diaTodo })).data;
}

// ---- Administração

export function useFilaFaltas(situacao?: SituacaoFalta, busca?: string) {
  return useQuery({
    queryKey: chavesFalta.fila(situacao, busca),
    queryFn: async () => (await api.get<FilaFaltas>("/faltas", { params: { situacao, busca: busca || undefined, porPagina: 50 } })).data,
  });
}

export function useDecidirFalta(aoConcluir?: () => void) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decisao, texto }: { id: string; decisao: "justificar" | "indeferir"; texto?: string }) =>
      (await api.post<Falta>(`/faltas/${id}/${decisao}`, decisao === "indeferir" ? { motivo: texto } : { observacao: texto || undefined })).data,
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ["faltas"] });
      aoConcluir?.();
    },
  });
}
