import { PrismaClient } from "@prisma/client";

// Evita múltiplas instâncias do PrismaClient em modo de desenvolvimento
// (ts-node-dev reinicia o processo a cada alteração de arquivo).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
