import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { autenticar, exigir } from "../../middlewares/auth";
import { TAMANHO_MAXIMO } from "../../storage/formatos";
import { enviarArquivo } from "../../utils/enviarArquivo";
import * as faltaService from "./falta.service";

export const faltaRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO, files: 1, fields: 5 } });
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).");

// Anexo aberto pelo link temporário (a assinatura autoriza; fica antes do `autenticar`)
const anexoSchema = z.object({ expira: z.coerce.number().int(), assinatura: z.string().min(10).max(100) });

faltaRouter.get("/:id/anexo", async (req, res, next) => {
  try {
    const { expira, assinatura } = anexoSchema.parse(req.query);
    enviarArquivo(res, next, await faltaService.abrirAnexo(req.params.id, expira, assinatura));
  } catch (err) {
    next(err);
  }
});

faltaRouter.use(autenticar);

// ---- Aluno

faltaRouter.get("/me", exigir("aluno:proprio"), async (req, res, next) => {
  try {
    res.json(await faltaService.minhasFaltas(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

const justificativaSchema = z.object({
  justificativa: z.string().trim().min(5, "Explique o motivo da falta.").max(500, "A justificativa pode ter até 500 caracteres."),
});

faltaRouter.post("/:id/justificativa", exigir("aluno:proprio"), upload.single("anexo"), async (req, res, next) => {
  try {
    const { justificativa } = justificativaSchema.parse(req.body ?? {});
    res.json(await faltaService.justificar(req.usuario!.sub, req.params.id, justificativa, req.file));
  } catch (err) {
    next(err);
  }
});

/** Link temporário do anexo (dono da falta ou administração). */
faltaRouter.post("/:id/anexo/link", async (req, res, next) => {
  try {
    res.json(await faltaService.gerarLinkAnexo(req.params.id, req.usuario!));
  } catch (err) {
    next(err);
  }
});

// ---- Administração

const listarSchema = z.object({
  situacao: z.enum(["AGUARDANDO_DECISAO", "SEM_JUSTIFICATIVA", "JUSTIFICADA", "INDEFERIDA"]).optional(),
  inicio: dia.optional(),
  fim: dia.optional(),
  universidadeId: z.string().uuid().optional(),
  alunoId: z.string().uuid().optional(),
  busca: z.string().max(80).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(30),
});

faltaRouter.get("/", exigir("alunos:ler"), async (req, res, next) => {
  try {
    res.json(await faltaService.listar(listarSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

const justificarSchema = z.object({ observacao: z.string().trim().max(300).optional() });

faltaRouter.post("/:id/justificar", exigir("alunos:gerenciar"), async (req, res, next) => {
  try {
    const { observacao } = justificarSchema.parse(req.body ?? {});
    res.json(await faltaService.decidir(req.usuario!.sub, req.params.id, "JUSTIFICADA", observacao));
  } catch (err) {
    next(err);
  }
});

const indeferirSchema = z.object({
  motivo: z.string().trim().min(5, "Informe o motivo do indeferimento (o aluno vai ler).").max(300, "O motivo pode ter até 300 caracteres."),
});

faltaRouter.post("/:id/indeferir", exigir("alunos:gerenciar"), async (req, res, next) => {
  try {
    const { motivo } = indeferirSchema.parse(req.body);
    res.json(await faltaService.decidir(req.usuario!.sub, req.params.id, "INDEFERIDA", motivo));
  } catch (err) {
    next(err);
  }
});
