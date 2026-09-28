import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { viagemRouter } from "../modules/viagens/viagem.routes";
import { universidadeRouter } from "../modules/universidades/universidade.routes";
import { onibusRouter } from "../modules/onibus/onibus.routes";
import { rotaRouter } from "../modules/rotas/rota.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { motoristaRouter } from "../modules/motoristas/motorista.routes";
import { notificacaoRouter } from "../modules/notificacoes/notificacao.routes";
import { alunoRouter } from "../modules/alunos/aluno.routes";

export const routes = Router();

routes.get("/", (_req, res) => {
  res.json({ nome: "Bus On API", status: "online", versao: "1.0.0" });
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
