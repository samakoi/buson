import { Router } from "express";
import { z } from "zod";
import { autenticar, exigir } from "../../middlewares/auth";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import * as alunoService from "./aluno.service";
import * as alocacaoService from "../alocacao/alocacao.service";

export const alunoRouter = Router();

alunoRouter.use(autenticar);

// ---- Próprio aluno

alunoRouter.get("/me", exigir("aluno:proprio"), async (req, res, next) => {
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

alunoRouter.patch("/me", exigir("aluno:proprio"), async (req, res, next) => {
  try {
    res.json(await alunoService.atualizarMeusDados(req.usuario!.sub, dadosSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

// ---- Dias de uso (alocação por dia da semana)

const diasSchema = z
  .object({
    dias: z
      .array(
        z
          .object({
            diaSemana: z.number().int().min(0).max(6),
            rotaId: z.string().uuid("Selecione a rota."),
            pontoEmbarqueId: z.string().uuid().nullable().optional(),
          })
          .strict()
      )
      .max(7)
      .refine((d) => new Set(d.map((x) => x.diaSemana)).size === d.length, "Dia da semana repetido."),
  })
  .strict();

async function alunoDoUsuario(usuarioId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId }, select: { id: true } });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  return aluno.id;
}

alunoRouter.get("/me/dias", exigir("aluno:proprio"), async (req, res, next) => {
  try {
    res.json(await alocacaoService.diasDoAluno(await alunoDoUsuario(req.usuario!.sub)));
  } catch (err) {
    next(err);
  }
});

alunoRouter.put("/me/dias", exigir("aluno:proprio"), async (req, res, next) => {
  try {
    const { dias } = diasSchema.parse(req.body);
    const alunoId = await alunoDoUsuario(req.usuario!.sub);
    await alocacaoService.definirDias(alunoId, dias, { usuarioId: req.usuario!.sub, admin: false });
    res.json(await alocacaoService.diasDoAluno(alunoId));
  } catch (err) {
    next(err);
  }
});

alunoRouter.get("/:id/dias", exigir("alunos:ler"), async (req, res, next) => {
  try {
    res.json(await alocacaoService.diasDoAluno(req.params.id));
  } catch (err) {
    next(err);
  }
});

/** Ajuste manual dos dias pelo admin (as mesmas regras de capacidade valem). */
alunoRouter.put("/:id/dias", exigir("alunos:gerenciar"), async (req, res, next) => {
  try {
    const { dias } = diasSchema.parse(req.body);
    await alocacaoService.definirDias(req.params.id, dias, { usuarioId: req.usuario!.sub, admin: true });
    res.json(await alocacaoService.diasDoAluno(req.params.id));
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
  documentoPendente: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

alunoRouter.get("/", exigir("alunos:ler"), async (req, res, next) => {
  try {
    res.json(await alunoService.listar(listarSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

alunoRouter.get("/:id", exigir("alunos:ler"), async (req, res, next) => {
  try {
    res.json(await alunoService.detalhar(req.params.id));
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status, motivo: z.string().trim().max(200).optional() });

alunoRouter.patch("/:id/status", exigir("alunos:gerenciar"), async (req, res, next) => {
  try {
    const { status: novo, motivo } = statusSchema.parse(req.body);
    await alunoService.alterarStatus(req.params.id, novo, motivo, req.usuario!.sub);
    res.json(await alunoService.detalhar(req.params.id));
  } catch (err) {
    next(err);
  }
});
