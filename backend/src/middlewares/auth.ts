import { NextFunction, Request, Response } from "express";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";
import { AppError } from "../errors/AppError";
import { Permissao, temPermissao } from "../auth/permissoes";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new AppError("NAO_AUTENTICADO"));
  try {
    req.usuario = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch {
    next(new AppError("TOKEN_INVALIDO"));
  }
}

/** Exige ao menos uma das permissões (o backend sempre valida — nunca só a interface). */
export function exigir(...permissoes: Permissao[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) return next(new AppError("NAO_AUTENTICADO"));
    if (!permissoes.some((p) => temPermissao(req.usuario!.papel, p))) return next(new AppError("SEM_PERMISSAO"));
    next();
  };
}
