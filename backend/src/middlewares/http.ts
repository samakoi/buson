import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../errors/AppError";

/**
 * Log de cada requisição: requestId, método, caminho, status, usuário e duração.
 * O requestId vem do cabeçalho X-Request-Id (se válido) ou é gerado, e volta na resposta.
 */
export const registroHttp = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const recebido = req.headers["x-request-id"];
    const id = typeof recebido === "string" && /^[\w-]{8,64}$/.test(recebido) ? recebido : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
  customProps: (req) => ({ usuarioId: (req as Request).usuario?.sub }),
  customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode} (erro)`,
  serializers: {
    req: (req) => ({ requestId: req.id, metodo: req.method, caminho: req.url }),
    res: (res) => ({ status: res.statusCode }),
  },
});

/**
 * CORS restritivo. Apps nativos não enviam Origin (sempre liberados); no
 * navegador só as origens listadas em CORS_ORIGINS ("*" apenas em desenvolvimento).
 */
export const corsRestrito = cors({
  origin: (origem, callback) => {
    if (!origem || env.corsOrigins.includes("*") || env.corsOrigins.includes(origem)) return callback(null, true);
    callback(new AppError("ORIGEM_NAO_PERMITIDA"));
  },
  exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy"],
});

/**
 * Padroniza as respostas de sucesso como { data: ... }. Erros já saem como
 * { error: {...} } pelo errorHandler (status >= 400), então passam direto.
 */
export function envelopeDeResposta(_req: Request, res: Response, next: NextFunction) {
  const json = res.json.bind(res);
  res.json = (corpo?: unknown) => json(res.statusCode >= 400 ? corpo : { data: corpo ?? null });
  next();
}

export function rotaNaoEncontrada(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError("ROTA_NAO_ENCONTRADA"));
}
