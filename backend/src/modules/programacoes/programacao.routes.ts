import { Router } from "express";
import { z } from "zod";
import { autenticar, exigir } from "../../middlewares/auth";
import * as programacaoService from "./programacao.service";

export const programacaoRouter = Router();

programacaoRouter.use(autenticar, exigir("viagens:gerenciar"));

const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:MM).");
const diasSemana = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Escolha ao menos um dia da semana.")
  .refine((d) => new Set(d).size === d.length, "Dia da semana repetido.");

const criarSchema = z
  .object({
    rotaId: z.string().uuid("Selecione a rota."),
    onibusId: z.string().uuid("Selecione o ônibus."),
    motoristaId: z.string().uuid("Selecione o motorista."),
    horarioIda: horario,
    horarioVolta: horario.nullable().optional(),
    diasSemana,
    ativa: z.boolean().optional(),
  })
  .strict();

// A rota não muda: para outra rota, crie outra programação
const atualizarSchema = criarSchema.omit({ rotaId: true }).partial().strict();

programacaoRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await programacaoService.listar());
  } catch (err) {
    next(err);
  }
});

/** Gera agora as viagens dos próximos dias (a geração também roda sozinha a cada hora). */
programacaoRouter.post("/gerar", async (_req, res, next) => {
  try {
    res.json(await programacaoService.gerarViagens());
  } catch (err) {
    next(err);
  }
});

programacaoRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await programacaoService.detalhar(req.params.id));
  } catch (err) {
    next(err);
  }
});

programacaoRouter.get("/:id/ocupacao", async (req, res, next) => {
  try {
    res.json((await programacaoService.detalhar(req.params.id)).ocupacao);
  } catch (err) {
    next(err);
  }
});

programacaoRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await programacaoService.criar(criarSchema.parse(req.body), req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

programacaoRouter.patch("/:id", async (req, res, next) => {
  try {
    res.json(await programacaoService.atualizar(req.params.id, atualizarSchema.parse(req.body), req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

programacaoRouter.delete("/:id", async (req, res, next) => {
  try {
    await programacaoService.excluir(req.params.id, req.usuario!.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
