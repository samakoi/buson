import path from "node:path";

/** Limite dos arquivos enviados pelos alunos (documentos e anexos de faltas). */
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/** Tipos aceitos, reconhecidos pelos primeiros bytes do arquivo (não pela extensão). */
const FORMATOS = [
  { mimeType: "application/pdf", extensao: "pdf", assinatura: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mimeType: "image/png", extensao: "png", assinatura: [0x89, 0x50, 0x4e, 0x47] },
  { mimeType: "image/jpeg", extensao: "jpg", assinatura: [0xff, 0xd8, 0xff] },
] as const;

export function detectarFormato(conteudo: Buffer) {
  return FORMATOS.find((f) => f.assinatura.every((byte, i) => conteudo[i] === byte)) ?? null;
}

/** Nome enviado pelo celular, sem pastas e com tamanho limitado. */
export function nomeSeguro(nome: string | undefined, extensao: string, padrao = "documento") {
  // Remove caracteres de controle (quebras de linha etc.) de propósito
  // eslint-disable-next-line no-control-regex
  const base = path.basename(nome || "").replace(/[\u0000-\u001f]/g, "").trim();
  return (base || `${padrao}.${extensao}`).slice(0, 180);
}
