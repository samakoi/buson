import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../services/api";
import { Documento, FilaDocumentos, StatusDocumento, TipoDocumento } from "../../types";

export const chavesDocumento = {
  meus: ["documentos", "meus"] as const,
  fila: (status?: StatusDocumento, busca?: string) => ["documentos", "fila", status ?? "todos", busca ?? ""] as const,
};

/** Arquivo escolhido na câmera, na galeria ou nos arquivos do aparelho. */
export interface ArquivoEscolhido {
  uri: string;
  nome: string;
  mimeType: string;
  tamanho: number | null;
  /** Só no navegador: o File do input */
  file?: File;
}

export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

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
      if (Platform.OS === "web") {
        const conteudo = arquivo.file ?? (await (await fetch(arquivo.uri)).blob());
        form.append("arquivo", conteudo, arquivo.nome);
      } else {
        // O FormData do React Native aceita { uri, name, type } para enviar um arquivo local
        form.append("arquivo", { uri: arquivo.uri, name: arquivo.nome, type: arquivo.mimeType } as unknown as Blob);
      }
      const { data } = await api.post<Documento>("/documentos", form, {
        headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
        transformRequest: (d) => d, // não deixa o axios transformar o FormData em JSON
        timeout: 120_000,
      });
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
export async function abrirDocumento(documentoId: string) {
  // No navegador a aba precisa abrir no próprio toque (senão vira pop-up bloqueado)
  const aba = Platform.OS === "web" ? window.open("", "_blank") : null;
  try {
    const { data } = await api.post<{ caminho: string; mimeType: string }>(`/documentos/${documentoId}/link`);
    const url = API_URL + data.caminho;
    if (Platform.OS !== "web") await WebBrowser.openBrowserAsync(url);
    else if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else window.location.assign(url);
    return data;
  } catch (err) {
    aba?.close();
    throw err;
  }
}

/** Link temporário para mostrar a imagem dentro do app. */
export async function linkDoDocumento(documentoId: string) {
  const { data } = await api.post<{ caminho: string; mimeType: string; expiraEm: string }>(`/documentos/${documentoId}/link`);
  return { ...data, url: API_URL + data.caminho };
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
