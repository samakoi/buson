import { Router } from "express";
import { z } from "zod";
import { autenticar, permitir } from "../../middlewares/auth";
import * as alunoService from "./aluno.service";

export const alunoRouter = Router();

alunoRouter.use(autenticar);

// ---- Próprio aluno

alunoRouter.get("/me", permitir("ALUNO"), async (req, res, next) => {
  try {
    res.json(await alunoService.meusDados(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

const dadosSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").optional(),
  matricula: z.string().trim().min(3, "Informe a matrícula.").max(40).optional(),
  curso: z.string().trim().min(2, "Informe o curso.").max(120).optional(),
  telefone: z
    .string()
    .trim()
    .transform((t) => t.replace(/\D/g, ""))
    .refine((t) => t.length >= 10 && t.length <= 11, "Telefone inválido (DDD + número).")
    .optional(),
  universidadeId: z.string().uuid("Selecione a universidade.").optional(),
});

alunoRouter.patch("/me", permitir("ALUNO"), async (req, res, next) => {
  try {
    res.json(await alunoService.atualizarMeusDados(req.usuario!.sub, dadosSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

// ---- Administração

const status = z.enum(["PENDENTE", "ATIVO", "INATIVO"]);

const listarSchema = z.object({
  busca: z.string().max(80).optional(),
  status: status.optional(),
  universidadeId: z.string().uuid().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

alunoRouter.get("/", permitir("ADMIN"), async (req, res, next) => {
  try {
    res.json(await alunoService.listar(listarSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

alunoRouter.get("/:id", permitir("ADMIN"), async (req, res, next) => {
  try {
    res.json(await alunoService.detalhar(req.params.id));
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status, motivo: z.string().trim().max(200).optional() });

alunoRouter.patch("/:id/status", permitir("ADMIN"), async (req, res, next) => {
  try {
    const { status: novo, motivo } = statusSchema.parse(req.body);
    await alunoService.alterarStatus(req.params.id, novo, motivo, req.usuario!.sub);
    res.json(await alunoService.detalhar(req.params.id));
  } catch (err) {
    next(err);
  }
});
