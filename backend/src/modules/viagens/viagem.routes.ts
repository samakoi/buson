import { Router } from "express";
import * as viagemController from "./viagem.controller";
import { autenticar, permitir } from "../../middlewares/auth";

export const viagemRouter = Router();

viagemRouter.use(autenticar);

viagemRouter.get("/", viagemController.listar);
viagemRouter.get("/atual", permitir("ALUNO", "MOTORISTA"), viagemController.atual);
viagemRouter.get("/:id/passageiros", permitir("MOTORISTA", "ADMIN"), viagemController.passageiros);
viagemRouter.get("/:id/rota", viagemController.rotaDoDia);

viagemRouter.post("/", permitir("ADMIN"), viagemController.criar);
viagemRouter.delete("/:id", permitir("ADMIN"), viagemController.excluir);

viagemRouter.post("/:id/checkin", permitir("ALUNO"), viagemController.checkin);
viagemRouter.post("/:id/checkin/cancelar", permitir("ALUNO"), viagemController.cancelarCheckin);

viagemRouter.post("/:id/embarque", permitir("MOTORISTA"), viagemController.embarque);
viagemRouter.post("/:id/iniciar", permitir("MOTORISTA"), viagemController.iniciar);
viagemRouter.post("/:id/encerrar", permitir("MOTORISTA"), viagemController.encerrar);
viagemRouter.post("/:id/localizacao", permitir("MOTORISTA"), viagemController.localizacao);
