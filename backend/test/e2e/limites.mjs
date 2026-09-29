// Fase 0 (parte 2) — limite de tentativas, validação do .env e logs estruturados
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { limparTST, ok, resultado } from "./lib.mjs";

const LIMITADA = "http://localhost:3335/api/v1"; // API com RATE_LIMIT_LOGIN_MAX=3 e RATE_LIMIT_CADASTRO_MAX=2
const post = async (path, body) => {
  const r = await fetch(LIMITADA + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, corpo: await r.json(), headers: r.headers };
};

// ---- Limite de login por IP + e-mail
const tentativas = [];
for (let i = 0; i < 4; i++) tentativas.push(await post("/auth/login", { email: "tst.limite@buson.com", senha: "errada" }));
ok(tentativas.slice(0, 3).every((t) => t.status === 401), "3 primeiras tentativas erradas → 401");
ok(tentativas[3].status === 429 && tentativas[3].corpo.error.code === "MUITAS_TENTATIVAS", "4ª tentativa → 429 MUITAS_TENTATIVAS", tentativas[3].corpo);
ok(!!tentativas[3].headers.get("ratelimit"), "resposta informa o limite (cabeçalho RateLimit)");
const outraPessoa = await post("/auth/login", { email: "tst.outra@buson.com", senha: "errada" });
ok(outraPessoa.status === 401, "outro e-mail na mesma rede não é bloqueado", outraPessoa.status);

// ---- Limite de cadastro por IP
const cadastros = [];
for (let i = 0; i < 3; i++) cadastros.push(await post("/auth/cadastro", { nome: "X", email: "invalido", senha: "1", universidadeId: "x" }));
ok(cadastros[2].status === 429, "cadastros em excesso → 429", cadastros.map((c) => c.status));

// ---- Validação do .env na inicialização
const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
function subir(env) {
  return spawnSync(process.execPath, ["dist/server.js"], { cwd: API_DIR, env: { ...process.env, PORT: "3399", ...env }, timeout: 8000, encoding: "utf8" });
}
const curto = subir({ JWT_SECRET: "curto" });
ok(curto.status !== 0 && /JWT_SECRET/.test(curto.stderr), "JWT_SECRET curto: a API não sobe e explica o motivo", curto.stderr.slice(0, 200));
const producao = subir({ NODE_ENV: "production", CORS_ORIGINS: "*", JWT_SECRET: "troque-este-valor-por-uma-string-aleatoria-grande" });
ok(producao.status !== 0 && /CORS_ORIGINS/.test(producao.stderr) && /JWT_SECRET/.test(producao.stderr), "produção recusa CORS '*' e segredo de exemplo", producao.stderr.slice(0, 300));

// ---- Logs estruturados (da API principal)
const linhas = readFileSync(process.env.LOG_ARQ, "utf8").split("\n").filter((l) => l.startsWith("{"));
const logs = linhas.map((l) => JSON.parse(l));
const comUsuario = logs.find((l) => l.req?.caminho?.includes("/dashboard/resumo") && l.usuarioId && typeof l.responseTime === "number" && l.req.requestId);
ok(!!comUsuario, "log por requisição com requestId, caminho, status, usuário e duração", comUsuario);
const erro4xx = logs.find((l) => l.res?.status === 401);
ok(erro4xx?.level === 40, "respostas 4xx são registradas como aviso (warn)", erro4xx?.level);
ok(!linhas.some((l) => /Bearer ey|"senha":"(?!\[oculto\])/.test(l)), "tokens e senhas não aparecem nos logs");

limparTST();
process.exit(resultado());
