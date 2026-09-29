import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

/**
 * Links temporários para abrir arquivos no navegador/visualizador, que não enviam o
 * token de login. A assinatura (HMAC com o segredo da API) amarra o link ao recurso,
 * ao id e ao horário de expiração.
 */
const VALIDADE_SEGUNDOS = 5 * 60;

function assinatura(recurso: string, id: string, expira: number) {
  return createHmac("sha256", env.jwtSecret).update(`${recurso}:${id}:${expira}`).digest("base64url");
}

/** Gera `expira` + `assinatura` para montar a URL (vale 5 minutos). */
export function assinarLink(recurso: string, id: string) {
  const expira = Math.floor(Date.now() / 1000) + VALIDADE_SEGUNDOS;
  return {
    query: `expira=${expira}&assinatura=${assinatura(recurso, id, expira)}`,
    expiraEm: new Date(expira * 1000).toISOString(),
  };
}

export function verificarLink(recurso: string, id: string, expira: number, recebida: string) {
  const esperada = Buffer.from(assinatura(recurso, id, expira));
  const enviada = Buffer.from(recebida);
  const valida = enviada.length === esperada.length && timingSafeEqual(enviada, esperada);
  if (!valida || expira < Date.now() / 1000) throw new AppError("LINK_INVALIDO");
}
