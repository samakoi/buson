// Executa os testes E2E da API: prepara um banco de TESTE, sobe duas APIs de teste e roda as suítes.
//
//   npm run build && npm run test:e2e
//
// Variáveis (com padrões para o ambiente de desenvolvimento):
//   DATABASE_URL_TESTE  mysql://root:senha123@localhost:3306/bus_on_test  (o nome do banco precisa terminar em _test)
//   MYSQL_CONTAINER     se definido, o SQL dos testes roda via "docker exec" nesse container (ex.: bus_on_mysql)
//   SUITES              lista separada por vírgula para rodar só algumas (ex.: SUITES=faltas,gps)
//
// Nunca aponte para o banco de produção: o executor recusa bancos cujo nome não termine em _test.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NOME_BANCO, sql } from "./lib.mjs";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url)); // pasta backend/
const AQUI = fileURLToPath(new URL(".", import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL_TESTE ?? "mysql://root:senha123@localhost:3306/bus_on_test";
const SUITES = ["base", "limites", "regressao", "alunos", "embarque-qr", "alocacao", "documentos", "faltas", "notificacoes", "gps"];

if (!/_test$/.test(NOME_BANCO)) {
  console.error(`Banco "${NOME_BANCO}" recusado: os testes só rodam em bancos cujo nome termina em _test.`);
  process.exit(2);
}

const temp = mkdtempSync(path.join(tmpdir(), "buson-e2e-"));
const uploads = path.join(temp, "uploads");
mkdirSync(uploads);
const logPrincipal = path.join(temp, "api-principal.log");

// Mesmo ambiente para as APIs e para as suítes (algumas sobem a API por conta própria)
const ambiente = {
  ...process.env,
  NODE_ENV: "test",
  TZ: process.env.TZ ?? "America/Fortaleza",
  DATABASE_URL,
  DATABASE_URL_TESTE: DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET ?? "segredo-dos-testes-e2e-com-mais-de-32-caracteres",
  CORS_ORIGINS: "http://localhost:8083",
  UPLOADS_DIR: uploads,
  LOG_LEVEL: "info",
  SENTRY_DSN: "",
};

function passo(titulo, comando, args, opcoes = {}) {
  console.log(`\n▶ ${titulo}`);
  // No Windows o npx é um .cmd e precisa do shell (argumentos fixos, sem entrada do usuário)
  const r =
    process.platform === "win32"
      ? spawnSync([comando, ...args].join(" "), { cwd: RAIZ, env: ambiente, stdio: "inherit", shell: true, ...opcoes })
      : spawnSync(comando, args, { cwd: RAIZ, env: ambiente, stdio: "inherit", ...opcoes });
  if (r.status !== 0) throw new Error(`${titulo} falhou (código ${r.status})`);
}

function subirApi(porta, extra, arquivoLog) {
  // A API escreve direto no arquivo: enquanto uma suíte roda (spawnSync), este processo fica
  // parado e não conseguiria repassar a saída — e as suítes leem esse log.
  const saida = arquivoLog ? openSync(arquivoLog, "a") : "ignore";
  return spawn(process.execPath, ["dist/server.js"], { cwd: RAIZ, env: { ...ambiente, PORT: String(porta), ...extra }, stdio: ["ignore", saida, "inherit"] });
}

async function esperarSaude(porta) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${porta}/api/v1/saude`);
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`A API de teste na porta ${porta} não respondeu`);
}

const apis = [];
let falhas = 0;
try {
  // 1) Banco de teste do zero: cria, aplica as migrações e o seed de desenvolvimento
  sql(`CREATE DATABASE IF NOT EXISTS \`${NOME_BANCO}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`, { semBanco: true });
  passo("Migrações no banco de teste", "npx", ["prisma", "migrate", "deploy"]);
  passo("Seed (usuários de desenvolvimento)", "npx", ["ts-node", "prisma/seed.ts"]);

  // 2) API principal (push falso, ciclos curtos) e API com limites baixos (testes de rate limit)
  apis.push(
    subirApi(
      3334,
      {
        RATE_LIMIT_LOGIN_MAX: "1000",
        RATE_LIMIT_CADASTRO_MAX: "1000",
        RATE_LIMIT_REFRESH_MAX: "1000",
        PUSH_MODO: "teste",
        PUSH_INTERVALO_MS: "300",
        RECIBOS_INTERVALO_MS: "600",
        RECIBOS_ESPERA_MS: "0",
        LEMBRETES_INTERVALO_MS: "1000",
        LEMBRETE_VESPERA_HORARIO: "00:00",
      },
      logPrincipal
    )
  );
  apis.push(subirApi(3335, { RATE_LIMIT_LOGIN_MAX: "3", RATE_LIMIT_CADASTRO_MAX: "2", PUSH_MODO: "desligado", DIAS_GERACAO_VIAGENS: "0" }));
  await Promise.all([esperarSaude(3334), esperarSaude(3335)]);

  // 3) Suítes, uma de cada vez (compartilham o banco)
  const escolhidas = process.env.SUITES ? process.env.SUITES.split(",").map((s) => s.trim()) : SUITES;
  const resumo = [];
  for (const suite of escolhidas) {
    console.log(`\n━━━━━━━━ ${suite}`);
    const r = spawnSync(process.execPath, [path.join(AQUI, `${suite}.mjs`)], {
      cwd: RAIZ,
      env: { ...ambiente, API: "http://localhost:3334/api/v1", LOG_ARQ: logPrincipal },
      stdio: "inherit",
      timeout: 10 * 60_000,
    });
    resumo.push(`${r.status === 0 ? "✅" : "❌"} ${suite}`);
    if (r.status !== 0) falhas++;
  }
  console.log(`\n${resumo.join("\n")}\n\n${falhas ? `${falhas} suíte(s) falharam` : "Todas as suítes passaram."}`);
} catch (err) {
  console.error(err);
  falhas++;
} finally {
  for (const api of apis) api.kill();
  await new Promise((r) => setTimeout(r, 500));
  try {
    rmSync(temp, { recursive: true, force: true });
  } catch {
    /* Windows pode segurar o arquivo de log por alguns instantes */
  }
}
process.exit(falhas ? 1 : 0);
