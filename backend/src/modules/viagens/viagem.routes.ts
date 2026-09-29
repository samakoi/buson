import { Router } from "express";
import * as viagemController from "./viagem.controller";
import { autenticar, exigir } from "../../middlewares/auth";
import { embarqueRouter } from "../embarque/embarque.routes";

export const viagemRouter = Router();

viagemRouter.use(autenticar);

viagemRouter.get("/", viagemController.listar);
viagemRouter.get("/atual", exigir("viagem:atual"), viagemController.atual);
// GPS: viagens em andamento no mapa (administração)
viagemRouter.get("/ao-vivo", exigir("dashboard:ler"), viagemController.aoVivo);
viagemRouter.get("/:id/passageiros", exigir("viagem:passageiros"), viagemController.passageiros);
viagemRouter.get("/:id/rota", viagemController.rotaDoDia);

viagemRouter.post("/", exigir("viagens:gerenciar"), viagemController.criar);
viagemRouter.delete("/:id", exigir("viagens:gerenciar"), viagemController.excluir);

viagemRouter.post("/:id/checkin", exigir("checkin:fazer"), viagemController.checkin);
viagemRouter.post("/:id/checkin/cancelar", exigir("checkin:fazer"), viagemController.cancelarCheckin);

viagemRouter.post("/:id/iniciar", exigir("viagem:operar"), viagemController.iniciar);
viagemRouter.post("/:id/encerrar", exigir("viagem:operar"), viagemController.encerrar);
// GPS: o motorista envia as leituras; alunos com vaga, o motorista e a administração consultam
viagemRouter.post("/:id/localizacao", exigir("viagem:operar"), viagemController.localizacao);
viagemRouter.get("/:id/localizacao", viagemController.posicaoAtual);
viagemRouter.get("/:id/trajeto", exigir("dashboard:ler"), viagemController.trajeto);

// Embarque pelo QR temporário do motorista (sessão, scan do aluno e manual)
viagemRouter.use("/:id/embarque", embarqueRouter);
