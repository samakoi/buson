import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { autenticar, exigir } from "../../middlewares/auth";
import * as notificacaoService from "./notificacao.service";
import * as pushService from "../push/push.service";
import { carteiro, CarteiroTeste } from "../push/carteiro";

export const notificacaoRouter = Router();

// Avisos do próprio usuário — os três perfis recebem notificações
notificacaoRouter.use(autenticar);

notificacaoRouter.get("/", async (req, res, next) => {
  try {
    res.json(await notificacaoService.listar(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

notificacaoRouter.post("/lidas", async (req, res, next) => {
  try {
    res.json(await notificacaoService.marcarTodasComoLidas(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

// ---- Push: aparelhos do usuário (vários por usuário)

const dispositivoSchema = z
  .object({
    token: z.string().trim().min(10).max(255),
    plataforma: z.enum(["ANDROID", "IOS"]),
    deviceId: z.string().trim().max(100).optional(),
  })
  .strict();

notificacaoRouter.post("/dispositivos", async (req, res, next) => {
  try {
    res.status(201).json(await pushService.registrarDispositivo(req.usuario!.sub, dispositivoSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

notificacaoRouter.post("/dispositivos/remover", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(10).max(255) }).parse(req.body);
    await pushService.removerDispositivo(req.usuario!.sub, token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Preferências: só lembretes e avisos de transporte podem ser desligados

notificacaoRouter.get("/preferencias", async (req, res, next) => {
  try {
    res.json(await pushService.preferencias(req.usuario!.sub));
  } catch (err) {
    next(err);
  }
});

const preferenciasSchema = z.object({ desligadas: z.array(z.enum(["LEMBRETE", "TRANSPORTE"])).max(2) }).strict();

notificacaoRouter.put("/preferencias", async (req, res, next) => {
  try {
    const { desligadas } = preferenciasSchema.parse(req.body);
    res.json(await pushService.salvarPreferencias(req.usuario!.sub, desligadas));
  } catch (err) {
    next(err);
  }
});

// Só nos testes automáticos (PUSH_MODO=teste): o que o carteiro falso "entregou"
if (env.push.modo === "teste" && !env.producao) {
  notificacaoRouter.get("/push-teste/enviados", exigir("dashboard:ler"), (req, res) => {
    const para = typeof req.query.para === "string" ? req.query.para : undefined;
    const enviados = (carteiro as CarteiroTeste).enviados;
    res.json(para ? enviados.filter((m) => m.para === para) : enviados);
  });
}
