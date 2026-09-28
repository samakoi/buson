import { Router } from "express";
import { autenticar } from "../../middlewares/auth";
import * as notificacaoService from "./notificacao.service";

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
