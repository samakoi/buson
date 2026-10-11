// Primeiro: o Sentry instrumenta o que for carregado depois
import "./instrumentacao";
import * as Sentry from "@sentry/node";
import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { iniciarAgendadorDeViagens } from "./modules/programacoes/programacao.service";
import { iniciarFilaPush } from "./modules/push/push.service";
import { iniciarLembretes } from "./modules/push/lembretes.service";
import { iniciarLimpezaGps } from "./modules/gps/localizacao.service";

const servidor = app.listen(env.port, () => {
  logger.info({ porta: env.port, ambiente: env.ambiente }, `Bus On API rodando em http://localhost:${env.port}/api/v1`);
  // Programação semanal: gera as viagens de ida/volta dos próximos dias
  iniciarAgendadorDeViagens();
  // Push no celular (fila em segundo plano) e lembretes de viagem
  iniciarFilaPush();
  iniciarLembretes();
  // GPS: apaga posições mais antigas que GPS_RETENCAO_DIAS
  iniciarLimpezaGps();
});

/**
 * Desligamento gracioso (docker stop / atualização): para de aceitar conexões, espera as
 * requisições em andamento, fecha o banco e envia os erros pendentes ao Sentry.
 * Os agendadores usam timers com unref(), então não seguram o processo.
 * Sem isso, o Node como PID 1 no container ignora o SIGTERM e o Docker o mata depois de 10 s.
 */
const LIMITE_DESLIGAMENTO_MS = 8000;
let desligando = false;

function desligar(sinal: NodeJS.Signals) {
  if (desligando) return;
  desligando = true;
  logger.info({ sinal }, "Desligando a API...");
  // Se algo travar, sai mesmo assim antes do SIGKILL do Docker
  setTimeout(() => {
    logger.error("Desligamento demorou demais; saindo à força");
    process.exit(1);
  }, LIMITE_DESLIGAMENTO_MS).unref();

  servidor.close(async (erro) => {
    if (erro) logger.error({ err: erro }, "Erro ao fechar o servidor HTTP");
    await prisma.$disconnect().catch((e) => logger.error({ err: e }, "Erro ao fechar o banco"));
    await Sentry.close(2000).catch(() => undefined);
    logger.info("API desligada");
    process.exit(erro ? 1 : 0);
  });
  // Conexões keep-alive ociosas não terminam sozinhas
  servidor.closeIdleConnections();
}

process.on("SIGTERM", desligar);
process.on("SIGINT", desligar);
