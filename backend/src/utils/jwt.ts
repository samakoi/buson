import jwt, { SignOptions } from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { Papel } from "@prisma/client";
import { env } from "../config/env";

export interface JwtPayload {
  sub: string; // id do usuário
  papel: Papel;
}

// JWT_EXPIRES_IN vem do .env como string (ex.: "15m"), formato aceito pelo jsonwebtoken
type ExpiresIn = SignOptions["expiresIn"];

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as ExpiresIn });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

/**
 * Refresh token opaco (aleatório, 48 bytes). O cliente guarda o token; o
 * banco guarda só o hash — um vazamento do banco não permite usar sessões.
 */
export function gerarRefreshToken() {
  const token = randomBytes(48).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
