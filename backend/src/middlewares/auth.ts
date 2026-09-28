import { NextFunction, Request, Response } from "express";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token de acesso não informado." });
  }
  const token = header.replace("Bearer ", "");
  try {
    req.usuario = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

export function permitir(...papeis: Array<"ALUNO" | "MOTORISTA" | "ADMIN">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: "Você não tem permissão para acessar este recurso." });
    }
    next();
  };
}
