import { NextFunction, Response } from "express";
import { Readable } from "node:stream";

/** Devolve um arquivo do armazenamento para o navegador/visualizador (aberto por link assinado). */
export function enviarArquivo(
  res: Response,
  next: NextFunction,
  arquivo: { conteudo: Readable; tamanho: number; mimeType: string; nomeOriginal: string }
) {
  res.setHeader("Content-Type", arquivo.mimeType);
  res.setHeader("Content-Length", String(arquivo.tamanho));
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(arquivo.nomeOriginal)}`);
  res.setHeader("Cache-Control", "private, no-store");
  // A imagem é exibida pelo app web (outra origem) e o PDF pelo visualizador do navegador
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.removeHeader("Content-Security-Policy");
  arquivo.conteudo.on("error", next).pipe(res);
}
