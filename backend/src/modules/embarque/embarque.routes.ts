import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { exigir } from "../../middlewares/auth";
import { AppError } from "../../errors/AppError";
import * as embarqueService from "./embarque.service";

/** Montado em /viagens/:id/embarque (a autenticação já vem do router de viagens). */
export const embarqueRouter = Router({ mergeParams: true });

async function motoristaDoUsuario(usuarioId: string) {
  const motorista = await prisma.motorista.findUnique({ where: { usuarioId } });
  if (!motorista) throw new AppError("PERFIL_MOTORISTA_NAO_ENCONTRADO");
  return motorista.id;
}

// Motorista gera/renova o QR temporário da viagem
embarqueRouter.post("/sessao", exigir("viagem:operar"), async (req, res, next) => {
  try {
    const motoristaId = await motoristaDoUsuario(req.usuario!.sub);
    res.status(201).json(await embarqueService.gerarSessao(req.params.id, motoristaId));
  } catch (err) {
    next(err);
  }
});

// Aluno escaneia o QR do motorista. O aluno é SEMPRE o do login — o corpo só traz o token.
const scanSchema = z.object({ token: z.string().min(20, "QR Code inválido.").max(200) }).strict();

embarqueRouter.post("/scan", exigir("embarque:escanear"), async (req, res, next) => {
  try {
    const { token } = scanSchema.parse(req.body);
    res.status(201).json(await embarqueService.escanear(req.params.id, req.usuario!.sub, token));
  } catch (err) {
    next(err);
  }
});

// Emergência: motorista confirma o embarque de um aluno com vaga confirmada
const manualSchema = z.object({ alunoId: z.string().uuid("Aluno inválido.") });

embarqueRouter.post("/manual", exigir("viagem:operar"), async (req, res, next) => {
  try {
    const { alunoId } = manualSchema.parse(req.body);
    const motoristaId = await motoristaDoUsuario(req.usuario!.sub);
    res.status(201).json(await embarqueService.registrarManual(req.params.id, motoristaId, req.usuario!.sub, alunoId));
  } catch (err) {
    next(err);
  }
});
