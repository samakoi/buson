import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "../../services/api";
import { formatarTamanho } from "../../utils/formatos";

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
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];

export class CameraSemPermissao extends Error {}

function daImagem(r: ImagePicker.ImagePickerResult, prefixo: string): ArquivoEscolhido | null {
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  const mimeType = a.mimeType ?? (a.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  return {
    uri: a.uri,
    nome: a.fileName ?? `${prefixo}-${Date.now()}.${mimeType === "image/png" ? "png" : "jpg"}`,
    mimeType,
    tamanho: a.fileSize ?? null,
    file: a.file ?? undefined,
  };
}

export async function tirarFoto(prefixo = "foto") {
  if (Platform.OS !== "web") {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) throw new CameraSemPermissao();
  }
  return daImagem(await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7 }), prefixo);
}

export async function daGaleria(prefixo = "foto") {
  return daImagem(await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7 }), prefixo);
}

export async function dePdf(): Promise<ArquivoEscolhido | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: TIPOS_ACEITOS, copyToCacheDirectory: true });
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  return { uri: a.uri, nome: a.name, mimeType: a.mimeType ?? "application/pdf", tamanho: a.size ?? null, file: a.file };
}

/** Mensagem de erro se o arquivo não puder ser enviado (a API confere de novo o conteúdo). */
export function problemaNoArquivo(a: ArquivoEscolhido): string | null {
  if (!TIPOS_ACEITOS.includes(a.mimeType)) return "Formato não aceito. Envie um PDF ou uma foto (JPG ou PNG).";
  if (a.tamanho && a.tamanho > TAMANHO_MAXIMO) return `O arquivo tem ${formatarTamanho(a.tamanho)}. O limite é 10 MB.`;
  return null;
}

/** Acrescenta o arquivo a um FormData: no celular pela URI, no navegador pelo File. */
export async function anexarArquivo(form: FormData, campo: string, arquivo: ArquivoEscolhido) {
  if (Platform.OS === "web") {
    form.append(campo, arquivo.file ?? (await (await fetch(arquivo.uri)).blob()), arquivo.nome);
  } else {
    // O FormData do React Native aceita { uri, name, type } para enviar um arquivo local
    form.append(campo, { uri: arquivo.uri, name: arquivo.nome, type: arquivo.mimeType } as unknown as Blob);
  }
}

/** Opções do axios para enviar multipart nos dois ambientes. */
export const opcoesMultipart = {
  headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
  transformRequest: (d: unknown) => d, // não deixa o axios transformar o FormData em JSON
  timeout: 120_000,
};

/**
 * Abre um arquivo protegido por link assinado (pedido à API na hora). No navegador a aba
 * abre no próprio toque (senão vira pop-up bloqueado); no celular, no navegador do app.
 */
export async function abrirPorLink(pedirCaminho: () => Promise<string>) {
  const aba = Platform.OS === "web" ? window.open("", "_blank") : null;
  try {
    const url = API_URL + (await pedirCaminho());
    if (Platform.OS !== "web") await WebBrowser.openBrowserAsync(url);
    else if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else window.location.assign(url);
  } catch (err) {
    aba?.close();
    throw err;
  }
}
