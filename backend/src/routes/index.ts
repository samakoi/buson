import { Router } from "express";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { authRouter } from "../modules/auth/auth.routes";
import { viagemRouter } from "../modules/viagens/viagem.routes";
import { universidadeRouter } from "../modules/universidades/universidade.routes";
import { onibusRouter } from "../modules/onibus/onibus.routes";
import { rotaRouter } from "../modules/rotas/rota.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { motoristaRouter } from "../modules/motoristas/motorista.routes";
import { notificacaoRouter } from "../modules/notificacoes/notificacao.routes";
import { alunoRouter } from "../modules/alunos/aluno.routes";
import { programacaoRouter } from "../modules/programacoes/programacao.routes";
import { pontoEmbarqueRouter } from "../modules/pontosEmbarque/pontoEmbarque.routes";
import { documentoRouter } from "../modules/documentos/documento.routes";
import { faltaRouter } from "../modules/faltas/falta.routes";

export const routes = Router();

routes.get("/", (_req, res) => {
  res.json({ nome: "Bus On API", status: "online", versao: "1.0.0", api: "v1" });
});

// Saúde: usado pelo Cloudflare/monitoramento para saber se API e banco respondem
routes.get("/saude", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ api: "ok", banco: "ok", versao: process.env.APP_VERSAO || "dev", horario: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// Versão mínima do app (pública): o app compara com o próprio versionCode e, se for menor,
// pede para instalar o APK novo (mudanças nativas não chegam pelas atualizações pela internet)
routes.get("/app/versao", (_req, res) => {
  res.json({ android: { versaoMinima: env.appAndroid.versaoMinima, link: env.appAndroid.link } });
});

routes.use("/auth", authRouter);
routes.use("/viagens", viagemRouter);
routes.use("/universidades", universidadeRouter);
routes.use("/onibus", onibusRouter);
routes.use("/rotas", rotaRouter);
routes.use("/dashboard", dashboardRouter);
routes.use("/motoristas", motoristaRouter);
routes.use("/notificacoes", notificacaoRouter);
routes.use("/alunos", alunoRouter);
routes.use("/programacoes", programacaoRouter);
routes.use("/pontos-embarque", pontoEmbarqueRouter);
routes.use("/documentos", documentoRouter);
routes.use("/faltas", faltaRouter);
