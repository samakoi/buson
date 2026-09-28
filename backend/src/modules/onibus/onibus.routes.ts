import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, permitir } from "../../middlewares/auth";
import { inicioDoDia } from "../../utils/datas";
import { notificarAlunos } from "../notificacoes/notificacao.service";

export const onibusRouter = Router();

onibusRouter.use(autenticar);

// Status da frota — qualquer usuário logado (o aluno vê se o ônibus está em manutenção)
onibusRouter.get("/status", async (_req, res, next) => {
  try {
    const onibus = await prisma.onibus.findMany({
      select: { id: true, placa: true, emManutencao: true, observacaoManutencao: true },
      orderBy: { placa: "asc" },
    });
    res.json(onibus);
  } catch (err) {
    next(err);
  }
});

onibusRouter.use(permitir("ADMIN"));

onibusRouter.get("/", async (_req, res, next) => {
  try {
    const onibus = await prisma.onibus.findMany({ orderBy: { placa: "asc" } });
    res.json(onibus);
  } catch (err) {
    next(err);
  }
});

const schema = z.object({
  placa: z.string().trim().toUpperCase().min(4, "A placa deve ter ao menos 4 caracteres."),
  capacidade: z.number().int().positive("A capacidade deve ser maior que zero.").default(30),
});

onibusRouter.post("/", async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const onibus = await prisma.onibus.create({ data: dados });
    res.status(201).json(onibus);
  } catch (err) {
    next(err);
  }
});

onibusRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = schema.partial().parse(req.body);
    const onibus = await prisma.onibus.update({ where: { id: req.params.id }, data: dados });
    res.json(onibus);
  } catch (err) {
    next(err);
  }
});

const manutencaoSchema = z.object({
  emManutencao: z.boolean(),
  observacao: z.string().trim().max(200).optional(),
});

onibusRouter.patch("/:id/manutencao", async (req, res, next) => {
  try {
    const { emManutencao, observacao } = manutencaoSchema.parse(req.body);
    const onibus = await prisma.onibus.update({
      where: { id: req.params.id },
      data: { emManutencao, observacaoManutencao: emManutencao ? observacao || null : null },
    });

    // Avisa os alunos com check-in ativo nas próximas viagens deste ônibus
    const afetados = await prisma.checkin.findMany({
      where: {
        status: { in: ["CONFIRMADO", "ESPERA"] },
        viagem: { onibusId: onibus.id, status: { not: "ENCERRADA" }, data: { gte: inicioDoDia() } },
      },
      select: { alunoId: true },
    });
    const mensagem = emManutencao
      ? `O ônibus ${onibus.placa} da sua viagem entrou em manutenção${onibus.observacaoManutencao ? `: ${onibus.observacaoManutencao}` : "."}`
      : `O ônibus ${onibus.placa} da sua viagem saiu da manutenção e voltou a operar.`;
    await notificarAlunos(prisma, afetados.map((c) => c.alunoId), { mensagem, categoria: "TRANSPORTE" });

    res.json(onibus);
  } catch (err) {
    next(err);
  }
});

onibusRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.onibus.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
