import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, exigir } from "../../middlewares/auth";
import { AppError } from "../../errors/AppError";
import { OPCOES_TX, revisarAlocacoes } from "../alocacao/alocacao.service";
import {
  atualizarRota,
  criarRota,
  deLegado,
  excluirRota,
  formatarRota,
  impactoExclusao,
  includeRota,
  rotaEdicaoSchema,
  rotaLegadaSchema,
  rotaSchema,
} from "./rota.service";

export const rotaRouter = Router();

/** Rotas disponíveis (as excluídas ficam de fora), cada uma com os trechos de ida e volta. */
rotaRouter.get("/", autenticar, async (_req, res, next) => {
  try {
    const rotas = await prisma.rota.findMany({ where: { excluidaEm: null }, include: includeRota, orderBy: { nome: "asc" } });
    res.json(rotas.map(formatarRota));
  } catch (err) {
    next(err);
  }
});

rotaRouter.get("/:id", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    const rota = await prisma.rota.findFirst({ where: { id: req.params.id, excluidaEm: null }, include: includeRota });
    if (!rota) throw new AppError("ROTA_NAO_CADASTRADA");
    res.json(formatarRota(rota));
  } catch (err) {
    next(err);
  }
});

/** Novo formato (ida e volta) ou o antigo (uma lista para os dois sentidos, de versões anteriores do app). */
export const schema = z.union([rotaSchema, rotaLegadaSchema]);
export const edicaoSchema = z.union([rotaEdicaoSchema, rotaLegadaSchema.partial().strict()]);
const ehNovo = (b: unknown) => !!b && typeof b === "object" && ("ida" in b || "volta" in b || "versao" in b);

rotaRouter.post("/", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    const rota = await prisma.$transaction(async (tx) => {
      const entrada = ehNovo(req.body) ? rotaSchema.parse(req.body) : await deLegado(tx, rotaLegadaSchema.parse(req.body));
      return criarRota(tx, entrada as z.output<typeof rotaSchema>, req.usuario!.sub);
    });
    res.status(201).json(formatarRota(rota));
  } catch (err) {
    next(err);
  }
});

/**
 * Edita nome e trechos. Alunos cuja instituição saiu da ida perdem os dias nela; quem
 * embarcava num ponto removido da ida é avisado para escolher outro.
 */
rotaRouter.patch("/:id", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    const rota = await prisma.$transaction(async (tx) => {
      let edicao;
      if (ehNovo(req.body)) edicao = rotaEdicaoSchema.parse(req.body);
      else {
        const legado = rotaLegadaSchema.partial().strict().parse(req.body);
        const atual = await tx.rota.findFirst({ where: { id: req.params.id, excluidaEm: null }, include: includeRota });
        if (!atual) throw new AppError("ROTA_NAO_CADASTRADA");
        edicao = await deLegado(tx, legado, atual);
      }
      const depois = await atualizarRota(tx, req.params.id, edicao, req.usuario!.sub);
      await revisarAlocacoes(tx, { rotaId: depois.id }, req.usuario!.sub);
      return depois;
    }, OPCOES_TX);
    res.json(formatarRota(rota));
  } catch (err) {
    next(err);
  }
});

/** O que a exclusão vai afetar: a tela mostra antes de pedir a confirmação. */
rotaRouter.get("/:id/impacto-exclusao", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    res.json(await impactoExclusao(prisma, req.params.id));
  } catch (err) {
    next(err);
  }
});

export const exclusaoQuerySchema = z.object({
  // Com alunos ou viagens vinculados, a exclusão só acontece com a confirmação explícita
  confirmarVinculos: z.enum(["true", "false"]).optional(),
});

rotaRouter.delete("/:id", autenticar, exigir("rotas:gerenciar"), async (req, res, next) => {
  try {
    const { confirmarVinculos } = exclusaoQuerySchema.parse(req.query);
    res.json(await excluirRota(req.params.id, req.usuario!.sub, confirmarVinculos === "true"));
  } catch (err) {
    next(err);
  }
});
