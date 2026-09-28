import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { Request } from "express";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

const QUINZE_MIN = 15 * 60_000;
const UMA_HORA = 60 * 60_000;

function limitador(windowMs: number, limit: number, chave?: (req: Request) => string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: chave ?? ((req) => ipKeyGenerator(req.ip ?? "")),
    // Mesmo formato de erro do resto da API
    handler: (_req, _res, next) => next(new AppError("MUITAS_TENTATIVAS")),
  });
}

/** Login: por IP + e-mail — uma pessoa não bloqueia a rede Wi-Fi inteira da faculdade. */
export const limiteLogin = limitador(QUINZE_MIN, env.rateLimit.login, (req) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
});

export const limiteCadastro = limitador(UMA_HORA, env.rateLimit.cadastro);

export const limiteRefresh = limitador(QUINZE_MIN, env.rateLimit.refresh);
