import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Documento, FilaDocumentos, StatusDocumento, TipoDocumento } from "../../types";
import { abrirPorLink, anexarArquivo, ArquivoEscolhido, opcoesMultipart } from "./escolherArquivo";

export const chavesDocumento = {
  meus: ["documentos", "meus"] as const,
  fila: (status?: StatusDocumento, busca?: string) => ["documentos", "fila", status ?? "todos", busca ?? ""] as const,
};

export function useMeusDocumentos() {
  return useQuery({
    queryKey: chavesDocumento.meus,
    queryFn: async () => (await api.get<Documento[]>("/documentos/me")).data,
  });
}

/** Envia o documento (multipart). No celular o arquivo vai pela URI; no navegador, pelo File. */
export function useEnviarDocumento() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ arquivo, tipo }: { arquivo: ArquivoEscolhido; tipo: TipoDocumento }) => {
      const form = new FormData();
      form.append("tipo", tipo);
      await anexarArquivo(form, "arquivo", arquivo);
      const { data } = await api.post<Documento>("/documentos", form, opcoesMultipart);
      return data;
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: chavesDocumento.meus });
      cliente.invalidateQueries({ queryKey: ["alunos", "me"] });
    },
  });
}

/**
 * Abre o arquivo por um link de 5 minutos (o navegador não envia o login).
 * Quando o admin abre um documento pendente, ele passa a "Em análise".
 */
export function abrirDocumento(documentoId: string) {
  return abrirPorLink(async () => (await api.post<{ caminho: string }>(`/documentos/${documentoId}/link`)).data.caminho);
}

// ---- Administração

export function useFilaDocumentos(status?: StatusDocumento, busca?: string) {
  return useQuery({
    queryKey: chavesDocumento.fila(status, busca),
    queryFn: async () => (await api.get<FilaDocumentos>("/documentos", { params: { status, busca: busca || undefined, porPagina: 50 } })).data,
  });
}

export function useAnalisarDocumento(aoConcluir?: () => void) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decisao, motivo }: { id: string; decisao: "aprovar" | "reprovar"; motivo?: string }) =>
      (await api.post<Documento>(`/documentos/${id}/${decisao}`, decisao === "reprovar" ? { motivo } : undefined)).data,
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ["documentos"] });
      aoConcluir?.();
    },
  });
}
