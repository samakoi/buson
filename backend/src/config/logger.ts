import pino from "pino";
import { env } from "./env";

/** Logs estruturados em JSON (um evento por linha) — fáceis de filtrar em produção. */
export const logger = pino({
  level: env.logLevel,
  base: { servico: "bus-on-api", ambiente: env.ambiente },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: ["req.headers.authorization", "req.headers.cookie", "*.senha", "*.refreshToken"], censor: "[oculto]" },
});
