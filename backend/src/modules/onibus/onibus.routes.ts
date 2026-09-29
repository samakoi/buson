import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, exigir } from "../../middlewares/auth";
import { inicioDoDia } from "../../utils/datas";
import { notificarAlunos } from "../notificacoes/notificacao.service";
import { diferenca, registrarAuditoria } from "../auditoria/auditoria.service";
import { AppError } from "../../errors/AppError";
import { OPCOES_TX } from "../alocacao/alocacao.service";
import { aplicarNovaCapacidade } from "../programacoes/programacao.service";

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

onibusRouter.use(exigir("frota:gerenciar"));

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
    const onibus = await prisma.$transaction(async (tx) => {
      const criado = await tx.onibus.create({ data: dados });
      await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "ONIBUS_CADASTRADO", entidade: "Onibus", entidadeId: criado.id, valorNovo: dados });
      return criado;
    });
    res.status(201).json(onibus);
  } catch (err) {
    next(err);
  }
});

onibusRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = schema.partial().parse(req.body);
    const onibus = await prisma.$transaction(async (tx) => {
      const antes = await tx.onibus.findUnique({ where: { id: req.params.id } });
      if (!antes) throw new AppError("ONIBUS_NAO_ENCONTRADO");
      // A capacidade do ônibus é a capacidade de cada dia das programações que o usam
      if (dados.capacidade !== undefined && dados.capacidade !== antes.capacidade) {
        await aplicarNovaCapacidade(tx, antes.id, dados.capacidade);
      }
      const atualizado = await tx.onibus.update({ where: { id: antes.id }, data: dados });
      const { valorAnterior, valorNovo, mudou } = diferenca(antes, dados);
      if (mudou) await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "ONIBUS_ALTERADO", entidade: "Onibus", entidadeId: antes.id, valorAnterior, valorNovo });
      return atualizado;
    }, OPCOES_TX);
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
    const novos = { emManutencao, observacaoManutencao: emManutencao ? observacao || null : null };
    const onibus = await prisma.$transaction(async (tx) => {
      const antes = await tx.onibus.findUnique({ where: { id: req.params.id } });
      if (!antes) throw new AppError("ONIBUS_NAO_ENCONTRADO");
      const atualizado = await tx.onibus.update({ where: { id: antes.id }, data: novos });
      const { valorAnterior, valorNovo } = diferenca(antes, novos);
      await registrarAuditoria(tx, {
        usuarioId: req.usuario!.sub,
        acao: emManutencao ? "ONIBUS_EM_MANUTENCAO" : "ONIBUS_LIBERADO",
        entidade: "Onibus",
        entidadeId: antes.id,
        valorAnterior,
        valorNovo,
      });
      return atualizado;
    });

    // Avisa os alunos com check-in ativo nas próximas viagens deste ônibus
    const afetados = await prisma.checkin.findMany({
      where: {
        status: { in: ["CONFIRMADO", "PROGRAMADO", "ESPERA"] },
        viagem: { onibusId: onibus.id, status: { not: "ENCERRADA" }, data: { gte: inicioDoDia() } },
      },
      select: { alunoId: true },
    });
    const mensagem = emManutencao
      ? `O ônibus ${onibus.placa} da sua viagem entrou em manutenção${onibus.observacaoManutencao ? `: ${onibus.observacaoManutencao}` : "."}`
      : `O ônibus ${onibus.placa} da sua viagem saiu da manutenção e voltou a operar.`;
    await notificarAlunos(prisma, afetados.map((c) => c.alunoId), { mensagem, categoria: "VIAGEM" });

    res.json(onibus);
  } catch (err) {
    next(err);
  }
});

onibusRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const removido = await tx.onibus.delete({ where: { id: req.params.id } });
      await registrarAuditoria(tx, {
        usuarioId: req.usuario!.sub,
        acao: "ONIBUS_REMOVIDO",
        entidade: "Onibus",
        entidadeId: removido.id,
        valorAnterior: { placa: removido.placa, capacidade: removido.capacidade },
      });
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
