import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { CodigoErro, ERROS } from "../errors/catalogo";

// Mantido para compatibilidade de import; o AppError agora vive em errors/
export { AppError };

// Erros conhecidos do Prisma que são culpa da requisição, não do servidor
const errosPrisma: Record<string, CodigoErro> = {
  P2002: "DUPLICADO",
  P2003: "EM_USO",
  P2025: "NAO_ENCONTRADO",
};

/** Primeira mensagem de validação, traduzindo o "Required" padrão do Zod. */
function mensagemZod(err: ZodError) {
  const primeiro = err.issues[0];
  if (!primeiro) return ERROS.VALIDACAO.mensagem;
  if (primeiro.code === "invalid_type" && primeiro.received === "undefined") {
    return `O campo "${primeiro.path.join(".")}" é obrigatório.`;
  }
  return primeiro.message;
}

function responder(req: Request, res: Response, status: number, codigo: CodigoErro, mensagem: string, detalhes?: unknown) {
  return res.status(status).json({
    error: { code: codigo, message: mensagem, ...(detalhes !== undefined && { details: detalhes }), requestId: req.id },
  });
}

/** Formato único de erro: { error: { code, message, details?, requestId } }. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return responder(req, res, err.status, err.codigo, err.message, err.detalhes);
  }
  if (err instanceof ZodError) {
    return responder(req, res, 400, "VALIDACAO", mensagemZod(err), err.flatten());
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && errosPrisma[err.code]) {
    const codigo = errosPrisma[err.code];
    return responder(req, res, ERROS[codigo].status, codigo, ERROS[codigo].mensagem);
  }
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return responder(req, res, 413, "ARQUIVO_MUITO_GRANDE", ERROS.ARQUIVO_MUITO_GRANDE.mensagem);
    return responder(req, res, 400, "VALIDACAO", "Não foi possível receber o arquivo. Envie um único arquivo no campo \"arquivo\".");
  }
  if (err instanceof SyntaxError && "body" in err) {
    return responder(req, res, 400, "VALIDACAO", "O corpo da requisição não é um JSON válido.");
  }
  // Inesperado: registra com o requestId e devolve mensagem genérica
  req.log?.error({ err }, "erro inesperado");
  return responder(req, res, 500, "ERRO_INTERNO", ERROS.ERRO_INTERNO.mensagem);
}
