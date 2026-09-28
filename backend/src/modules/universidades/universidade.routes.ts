import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, permitir } from "../../middlewares/auth";

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

universidadeRouter.post("/", autenticar, permitir("ADMIN"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const universidade = await prisma.universidade.create({ data: dados });
    res.status(201).json(universidade);
  } catch (err) {
    next(err);
  }
});

universidadeRouter.delete("/:id", autenticar, permitir("ADMIN"), async (req, res, next) => {
  try {
    await prisma.universidade.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
