import "dotenv/config"; // o .env precisa estar carregado antes do Sentry
import * as Sentry from "@sentry/node";

/**
 * Sentry (erros da API em produção). Precisa ser o primeiro import do server.ts.
 * Sem SENTRY_DSN no .env, fica desligado. Não envia dados pessoais (corpo das
 * requisições, cabeçalhos de autorização): só o erro, a rota e o requestId.
 */
const dsn = process.env.SENTRY_DSN?.trim();

export const sentryAtivo = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.APP_VERSAO || undefined,
    // Nada de dados pessoais: sem cabeçalhos (tokens), corpos (senhas, documentos),
    // cookies, parâmetros de URL (links assinados) nem dados de usuário automáticos
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
  });
}

/** Registra um erro inesperado (500) com o requestId para achar o log correspondente. */
export function registrarErro(err: unknown, contexto: { requestId?: string; rota?: string; usuarioId?: string } = {}) {
  if (!sentryAtivo) return;
  Sentry.withScope((escopo) => {
    if (contexto.requestId) escopo.setTag("requestId", contexto.requestId);
    if (contexto.rota) escopo.setTag("rota", contexto.rota);
    if (contexto.usuarioId) escopo.setUser({ id: contexto.usuarioId });
    Sentry.captureException(err);
  });
}
