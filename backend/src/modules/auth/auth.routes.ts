import { Router } from "express";
import * as authController from "./auth.controller";
import { autenticar } from "../../middlewares/auth";
import { limiteCadastro, limiteLogin, limiteRefresh } from "../../middlewares/rateLimit";

export const authRouter = Router();

authRouter.post("/cadastro", limiteCadastro, authController.cadastrar);
authRouter.post("/login", limiteLogin, authController.autenticar);
authRouter.post("/refresh", limiteRefresh, authController.renovarToken);
authRouter.get("/me", autenticar, authController.me);

// Sessões por dispositivo
authRouter.post("/logout", authController.sair); // sair deste dispositivo (só precisa do refresh token)
authRouter.post("/logout-todos", autenticar, authController.sairDeTodos);
authRouter.get("/sessoes", autenticar, authController.sessoes);
authRouter.delete("/sessoes/:id", autenticar, authController.encerrarSessao);
