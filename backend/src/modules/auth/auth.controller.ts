import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "./auth.service";
import { verifyRefreshToken, signAccessToken } from "../../utils/jwt";
import { AppError } from "../../middlewares/errorHandler";

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  email,
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  universidadeId: z.string().uuid("Selecione sua universidade."),
});

const loginSchema = z.object({
  email,
  senha: z.string().min(1, "Informe a senha."),
});

export async function cadastrar(req: Request, res: Response, next: NextFunction) {
  try {
    const dados = cadastroSchema.parse(req.body);
    const usuario = await authService.cadastrarAluno(dados);
    res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  } catch (err) {
    next(err);
  }
}

export async function autenticar(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const resultado = await authService.login(email, senha);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = await authService.perfil(req.usuario!.sub);
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function renovarToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError("refreshToken é obrigatório.", 400);
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({ sub: payload.sub, papel: payload.papel });
    res.json({ accessToken });
  } catch {
    next(new AppError("Refresh token inválido ou expirado.", 401));
  }
}
