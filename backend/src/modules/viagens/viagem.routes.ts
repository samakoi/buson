import { Router } from "express";
import * as viagemController from "./viagem.controller";
import { autenticar, exigir } from "../../middlewares/auth";

export const viagemRouter = Router();

viagemRouter.use(autenticar);

viagemRouter.get("/", viagemController.listar);
viagemRouter.get("/atual", exigir("viagem:atual"), viagemController.atual);
viagemRouter.get("/:id/passageiros", exigir("viagem:passageiros"), viagemController.passageiros);
viagemRouter.get("/:id/rota", viagemController.rotaDoDia);

viagemRouter.post("/", exigir("viagens:gerenciar"), viagemController.criar);
viagemRouter.delete("/:id", exigir("viagens:gerenciar"), viagemController.excluir);

viagemRouter.post("/:id/checkin", exigir("checkin:fazer"), viagemController.checkin);
viagemRouter.post("/:id/checkin/cancelar", exigir("checkin:fazer"), viagemController.cancelarCheckin);

viagemRouter.post("/:id/embarque", exigir("viagem:operar"), viagemController.embarque);
viagemRouter.post("/:id/iniciar", exigir("viagem:operar"), viagemController.iniciar);
viagemRouter.post("/:id/encerrar", exigir("viagem:operar"), viagemController.encerrar);
viagemRouter.post("/:id/localizacao", exigir("viagem:operar"), viagemController.localizacao);
