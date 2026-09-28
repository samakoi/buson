import { Router } from "express";
import * as authController from "./auth.controller";
import { autenticar } from "../../middlewares/auth";

export const authRouter = Router();

authRouter.post("/cadastro", authController.cadastrar);
authRouter.post("/login", authController.autenticar);
authRouter.post("/refresh", authController.renovarToken);
authRouter.get("/me", autenticar, authController.me);
