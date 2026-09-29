import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, exigir } from "../../middlewares/auth";
import { AppError } from "../../errors/AppError";
import { diferenca, registrarAuditoria } from "../auditoria/auditoria.service";
import { OPCOES_TX, revisarAlocacoes } from "../alocacao/alocacao.service";

/** Pontos de embarque (onde os alunos esperam o ônibus na ida). */
export const pontoEmbarqueRouter = Router();

pontoEmbarqueRouter.use(autenticar);

pontoEmbarqueRouter.get("/", async (req, res, next) => {
  try {
    const todos = req.query.todos === "true";
    const pontos = await prisma.pontoEmbarque.findMany({
      where: todos ? undefined : { ativo: true },
      include: { _count: { select: { rotas: true } } },
      orderBy: { nome: "asc" },
    });
    res.json(pontos);
  } catch (err) {
    next(err);
  }
});

pontoEmbarqueRouter.use(exigir("rotas:gerenciar"));

const schema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome do ponto.").max(120),
    endereco: z.string().trim().max(200).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

pontoEmbarqueRouter.post("/", async (req, res, next) => {
  try {
    const dados = schema.parse(req.body);
    const ponto = await prisma.$transaction(async (tx) => {
      const criado = await tx.pontoEmbarque.create({ data: dados });
      await registrarAuditoria(tx, {
        usuarioId: req.usuario!.sub,
        acao: "PONTO_EMBARQUE_CADASTRADO",
        entidade: "PontoEmbarque",
        entidadeId: criado.id,
        valorNovo: { nome: criado.nome, endereco: criado.endereco },
      });
      return criado;
    });
    res.status(201).json(ponto);
  } catch (err) {
    next(err);
  }
});

pontoEmbarqueRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = schema.partial().parse(req.body);
    const ponto = await prisma.$transaction(async (tx) => {
      const antes = await tx.pontoEmbarque.findUnique({ where: { id: req.params.id } });
      if (!antes) throw new AppError("PONTO_EMBARQUE_NAO_ENCONTRADO");
      const atualizado = await tx.pontoEmbarque.update({ where: { id: antes.id }, data: dados });
      const { valorAnterior, valorNovo, mudou } = diferenca(antes, dados);
      if (mudou) {
        await registrarAuditoria(tx, { usuarioId: req.usuario!.sub, acao: "PONTO_EMBARQUE_ALTERADO", entidade: "PontoEmbarque", entidadeId: antes.id, valorAnterior, valorNovo });
      }
      // Ponto desativado sai das rotas: quem embarcava nele escolhe outro
      if (antes.ativo && dados.ativo === false) {
        const rotas = await tx.rotaPontoEmbarque.findMany({ where: { pontoEmbarqueId: antes.id }, select: { rotaId: true } });
        await tx.rotaPontoEmbarque.deleteMany({ where: { pontoEmbarqueId: antes.id } });
        for (const { rotaId } of rotas) await revisarAlocacoes(tx, { rotaId }, req.usuario!.sub);
      }
      return atualizado;
    }, OPCOES_TX);
    res.json(ponto);
  } catch (err) {
    next(err);
  }
});

pontoEmbarqueRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Em uso por alguma rota: o banco recusa (EM_USO) — desative em vez de excluir
      const removido = await tx.pontoEmbarque.delete({ where: { id: req.params.id } });
      await registrarAuditoria(tx, {
        usuarioId: req.usuario!.sub,
        acao: "PONTO_EMBARQUE_REMOVIDO",
        entidade: "PontoEmbarque",
        entidadeId: removido.id,
        valorAnterior: { nome: removido.nome },
      });
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
