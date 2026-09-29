import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { autenticar, exigir } from "../../middlewares/auth";
import { enviarArquivo } from "../../utils/enviarArquivo";
import * as documentoService from "./documento.service";

export const documentoRouter = Router();

// Arquivo fica só na memória até ser conferido e salvo no armazenamento
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: documentoService.TAMANHO_MAXIMO, files: 1, fields: 5 } });

const statusDocumento = z.enum(["PENDENTE", "EM_ANALISE", "APROVADO", "REPROVADO"]);

/**
 * Abre o arquivo pelo link temporário (o navegador/visualizador não manda o token de
 * login; a assinatura do link é que autoriza). Fica antes do `autenticar`.
 */
const arquivoSchema = z.object({ expira: z.coerce.number().int(), assinatura: z.string().min(10).max(100) });

documentoRouter.get("/:id/arquivo", async (req, res, next) => {
  try {
    const { expira, assinatura } = arquivoSchema.parse(req.query);
    enviarArquivo(res, next, await documentoService.abrirArquivo(req.params.id, expira, assinatura));
  } catch (err) {
    next(err);
  }
});

documentoRouter.use(autenticar);

// ---- Aluno

const envioSchema = z.object({ tipo: z.enum(["DECLARACAO", "COMPROVANTE", "OUTRO"]).default("COMPROVANTE") });

documentoRouter.post("/", exigir("aluno:proprio"), upload.single("arquivo"), async (req, res, next) => {
  try {
    const { tipo } = envioSchema.parse(req.body ?? {});
    res.status(201).json(await documentoService.enviar(req.usuario!.sub, req.file, tipo));
  } catch (err) {
    next(err);
  }
});

documentoRouter.get("/me", exigir("aluno:proprio"), async (req, res, next) => {
  try {
    res.json(await documentoService.meusDocumentos(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

/** Link temporário para ver o arquivo (dono do documento ou administração). */
documentoRouter.post("/:id/link", async (req, res, next) => {
  try {
    res.json(await documentoService.gerarLink(req.params.id, req.usuario!));
  } catch (err) {
    next(err);
  }
});

// ---- Administração

const listarSchema = z.object({
  status: statusDocumento.optional(),
  busca: z.string().max(80).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

documentoRouter.get("/", exigir("alunos:ler"), async (req, res, next) => {
  try {
    res.json(await documentoService.listar(listarSchema.parse(req.query)));
  } catch (err) {
    next(err);
  }
});

documentoRouter.post("/:id/aprovar", exigir("alunos:gerenciar"), async (req, res, next) => {
  try {
    res.json(await documentoService.aprovar(req.params.id, req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

const reprovarSchema = z.object({
  motivo: z.string().trim().min(5, "Informe o motivo da reprovação (o aluno vai ler).").max(300, "O motivo pode ter até 300 caracteres."),
});

documentoRouter.post("/:id/reprovar", exigir("alunos:gerenciar"), async (req, res, next) => {
  try {
    const { motivo } = reprovarSchema.parse(req.body);
    res.json(await documentoService.reprovar(req.params.id, req.usuario!.sub, motivo));
  } catch (err) {
    next(err);
  }
});
