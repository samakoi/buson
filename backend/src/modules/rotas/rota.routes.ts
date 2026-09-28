import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, permitir } from "../../middlewares/auth";

export const rotaRouter = Router();

rotaRouter.get("/", autenticar, async (_req, res, next) => {
  try {
    const rotas = await prisma.rota.findMany({
      include: { pontos: { include: { universidade: true }, orderBy: { ordem: "asc" } } },
      orderBy: { nome: "asc" },
    });
    res.json(rotas);
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da rota."),
  // Universidades na ordem das paradas
  universidadeIds: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos uma universidade.")
    .refine((ids) => new Set(ids).size === ids.length, "A mesma universidade não pode aparecer duas vezes."),
});

rotaRouter.post("/", autenticar, permitir("ADMIN"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const rota = await prisma.rota.create({
      data: {
        nome: dados.nome,
        pontos: { create: dados.universidadeIds.map((universidadeId, i) => ({ universidadeId, ordem: i + 1 })) },
      },
      include: { pontos: { include: { universidade: true }, orderBy: { ordem: "asc" } } },
    });
    res.status(201).json(rota);
  } catch (err) {
    next(err);
  }
});

rotaRouter.delete("/:id", autenticar, permitir("ADMIN"), async (req, res, next) => {
  try {
    await prisma.rota.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
