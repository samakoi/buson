import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, exigir } from "../../middlewares/auth";
import { registrarAuditoria } from "../auditoria/auditoria.service";

export const universidadeRouter = Router();

// Listagem é pública (necessária na tela de cadastro do aluno)
universidadeRouter.get("/", async (_req, res, next) => {
  try {
    const universidades = await prisma.universidade.findMany({ orderBy: { nome: "asc" } });
    res.json(universidades);
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da universidade."),
  endereco: z.string().trim().optional(),
});

universidadeRouter.post("/", autenticar, exigir("instituicoes:gerenciar"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const universidade = await prisma.$transaction(async (tx) => {
      const criada = await tx.universidade.create({ data: dados });
      await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "INSTITUICAO_CADASTRADA", entidade: "Universidade", entidadeId: criada.id, valorNovo: dados });
      return criada;
    });
    res.status(201).json(universidade);
  } catch (err) {
    next(err);
  }
});

universidadeRouter.delete("/:id", autenticar, exigir("instituicoes:gerenciar"), async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const removida = await tx.universidade.delete({ where: { id: req.params.id } });
      await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "INSTITUICAO_REMOVIDA", entidade: "Universidade", entidadeId: removida.id, valorAnterior: { nome: removida.nome } });
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
