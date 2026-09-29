import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { iniciarAgendadorDeViagens } from "./modules/programacoes/programacao.service";
import { iniciarFilaPush } from "./modules/push/push.service";
import { iniciarLembretes } from "./modules/push/lembretes.service";

app.listen(env.port, () => {
  logger.info({ porta: env.port, ambiente: env.ambiente }, `Bus On API rodando em http://localhost:${env.port}/api/v1`);
  // Programação semanal: gera as viagens de ida/volta dos próximos dias
  iniciarAgendadorDeViagens();
  // Push no celular (fila em segundo plano) e lembretes de viagem
  iniciarFilaPush();
  iniciarLembretes();
});
