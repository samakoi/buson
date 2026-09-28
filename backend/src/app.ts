import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { routes } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { corsRestrito, envelopeDeResposta, registroHttp, rotaNaoEncontrada } from "./middlewares/http";

export const app = express();

// Atrás do Cloudflare Tunnel o IP real do cliente vem nos cabeçalhos do proxy
app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");

app.use(registroHttp); // requestId + log de cada requisição
app.use(helmet());
app.use(corsRestrito);
app.use(express.json({ limit: "100kb" }));
app.use(envelopeDeResposta);

app.use("/api/v1", routes);

app.use(rotaNaoEncontrada);
app.use(errorHandler);
