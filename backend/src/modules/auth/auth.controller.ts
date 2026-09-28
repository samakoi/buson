import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "./auth.service";


const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.");

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  email,
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  universidadeId: z.string().uuid("Selecione sua universidade."),
});

const deviceId = z.string().trim().max(100).optional();

const loginSchema = z.object({
  email,
  senha: z.string().min(1, "Informe a senha."),
  deviceId,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20, "Sessão inválida. Entre novamente."),
  deviceId,
});

/** Dados do aparelho que ficam na sessão (IP real via "trust proxy" atrás do Cloudflare). */
function contexto(req: Request, deviceIdInformado?: string): authService.ContextoSessao {
  return { deviceId: deviceIdInformado, ip: req.ip, userAgent: req.get("user-agent") ?? undefined };
}

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
    const { email, senha, deviceId: dispositivo } = loginSchema.parse(req.body);
    res.json(await authService.login(email, senha, contexto(req, dispositivo)));
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
    const { refreshToken, deviceId: dispositivo } = refreshSchema.parse(req.body);
    res.json(await authService.renovar(refreshToken, contexto(req, dispositivo)));
  } catch (err) {
    next(err);
  }
}

export async function sair(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function sairDeTodos(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await authService.logoutTodos(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
}

export async function sessoes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await authService.listarSessoes(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
}

export async function encerrarSessao(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.revogarSessao(req.usuario!.sub, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
