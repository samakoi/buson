import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, exigir } from "../../middlewares/auth";
import { AppError } from "../../errors/AppError";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { OPCOES_TX, revisarAlocacoes } from "../alocacao/alocacao.service";

export const rotaRouter = Router();

const includeRota = {
  pontos: { include: { universidade: true }, orderBy: { ordem: "asc" } },
  pontosEmbarque: { include: { pontoEmbarque: true }, orderBy: { ordem: "asc" } },
} satisfies Prisma.RotaInclude;

type RotaCompleta = Prisma.RotaGetPayload<{ include: typeof includeRota }>;

const descrever = (r: RotaCompleta) => ({
  nome: r.nome,
  paradas: r.pontos.map((p) => p.universidade.nome),
  pontosEmbarque: r.pontosEmbarque.map((p) => p.pontoEmbarque.nome),
});

rotaRouter.get("/", autenticar, async (_req, res, next) => {
  try {
    const rotas = await prisma.rota.findMany({ include: includeRota, orderBy: { nome: "asc" } });
    res.json(rotas);
  } catch (err) {
    next(err);
  }
});

const semRepetir = (ids: string[]) => new Set(ids).size === ids.length;

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da rota."),
  // Universidades na ordem das paradas
  universidadeIds: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos uma universidade.")
    .refine(semRepetir, "A mesma universidade não pode aparecer duas vezes."),
  // Pontos de embarque na ordem em que o ônibus passa (opcional)
  pontosEmbarqueIds: z.array(z.string().uuid()).refine(semRepetir, "O mesmo ponto não pode aparecer duas vezes.").optional(),
});

async function conferirPontos(tx: Prisma.TransactionClient, ids: string[] | undefined) {
  if (!ids?.length) return;
  const ativos = await tx.pontoEmbarque.count({ where: { id: { in: ids }, ativo: true } });
  if (ativos !== ids.length) throw new AppError("PONTO_EMBARQUE_NAO_ENCONTRADO");
}

rotaRouter.post("/", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const rota = await prisma.$transaction(async (tx) => {
      await conferirPontos(tx, dados.pontosEmbarqueIds);
      const criada = await tx.rota.create({
        data: {
          nome: dados.nome,
          pontos: { create: dados.universidadeIds.map((universidadeId, i) => ({ universidadeId, ordem: i + 1 })) },
          pontosEmbarque: { create: (dados.pontosEmbarqueIds ?? []).map((pontoEmbarqueId, i) => ({ pontoEmbarqueId, ordem: i + 1 })) },
        },
        include: includeRota,
      });
      await registrarAuditoria(tx, {
        usuarioId: req.usuario!.sub,
        acao: "ROTA_CADASTRADA",
        entidade: "Rota",
        entidadeId: criada.id,
        valorNovo: descrever(criada),
      });
      return criada;
    });
    res.status(201).json(rota);
  } catch (err) {
    next(err);
  }
});

/**
 * Edita nome, paradas e pontos de embarque. Alunos cuja instituição saiu da rota perdem
 * os dias nela; quem embarcava num ponto removido é avisado para escolher outro.
 */
rotaRouter.patch("/:id", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    const dados = schema.partial().parse(req.body);
    const rota = await prisma.$transaction(async (tx) => {
      const antes = await tx.rota.findUnique({ where: { id: req.params.id }, include: includeRota });
      if (!antes) throw new AppError("ROTA_NAO_CADASTRADA");
      await conferirPontos(tx, dados.pontosEmbarqueIds);

      if (dados.nome) await tx.rota.update({ where: { id: antes.id }, data: { nome: dados.nome } });
      if (dados.universidadeIds) {
        await tx.pontoRota.deleteMany({ where: { rotaId: antes.id } });
        await tx.pontoRota.createMany({ data: dados.universidadeIds.map((universidadeId, i) => ({ rotaId: antes.id, universidadeId, ordem: i + 1 })) });
      }
      if (dados.pontosEmbarqueIds) {
        await tx.rotaPontoEmbarque.deleteMany({ where: { rotaId: antes.id } });
        await tx.rotaPontoEmbarque.createMany({
          data: dados.pontosEmbarqueIds.map((pontoEmbarqueId, i) => ({ rotaId: antes.id, pontoEmbarqueId, ordem: i + 1 })),
        });
      }

      const depois = await tx.rota.findUniqueOrThrow({ where: { id: antes.id }, include: includeRota });
      const [a, d] = [descrever(antes), descrever(depois)];
      if (JSON.stringify(a) !== JSON.stringify(d)) {
        await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "ROTA_ALTERADA", entidade: "Rota", entidadeId: antes.id, valorAnterior: a, valorNovo: d });
      }
      await revisarAlocacoes(tx, { rotaId: antes.id }, req.usuario!.sub);
      return depois;
    }, OPCOES_TX);
    res.json(rota);
  } catch (err) {
    next(err);
  }
});

rotaRouter.delete("/:id", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const removida = await tx.rota.delete({ where: { id: req.params.id } });
      await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "ROTA_REMOVIDA", entidade: "Rota", entidadeId: removida.id, valorAnterior: { nome: removida.nome } });
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
