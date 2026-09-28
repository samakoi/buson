import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public mensagem: string, public status = 400) {
    super(mensagem);
  }
}

// Erros conhecidos do Prisma que são culpa da requisição, não do servidor
const errosPrisma: Record<string, { status: number; mensagem: string }> = {
  P2002: { status: 409, mensagem: "Já existe um cadastro com esses dados." },
  P2003: { status: 409, mensagem: "Este registro está em uso e não pode ser removido (ou referencia algo que não existe)." },
  P2025: { status: 404, mensagem: "Registro não encontrado." },
};

/** Primeira mensagem de validação, traduzindo o "Required" padrão do Zod. */
function mensagemZod(err: ZodError) {
  const primeiro = err.issues[0];
  if (!primeiro) return "Dados inválidos.";
  if (primeiro.code === "invalid_type" && primeiro.received === "undefined") {
    return `O campo "${primeiro.path.join(".")}" é obrigatório.`;
  }
  return primeiro.message;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.mensagem });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ erro: mensagemZod(err), detalhes: err.flatten() });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && errosPrisma[err.code]) {
    const { status, mensagem } = errosPrisma[err.code];
    return res.status(status).json({ erro: mensagem });
  }
  console.error(err);
  return res.status(500).json({ erro: "Erro interno do servidor." });
}
