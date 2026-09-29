// Utilitários comuns dos testes E2E do Bus On (dados sempre prefixados TST e removidos no fim).
// Rodam contra uma API de teste (API) ligada a um banco de TESTE (DATABASE_URL_TESTE):
// veja test/e2e/executar.mjs, que prepara tudo isso.
import { execFileSync } from "node:child_process";

export const BASE = process.env.API ?? "http://localhost:3334/api/v1";

const banco = new URL(process.env.DATABASE_URL_TESTE ?? "mysql://root:senha123@localhost:3306/bus_on_test");
export const NOME_BANCO = banco.pathname.slice(1);
const usuario = decodeURIComponent(banco.username);
const senha = decodeURIComponent(banco.password);

/**
 * Executa SQL no banco de teste e devolve a saída (colunas separadas por tab).
 * Sem shell: pelo cliente `mysql` local ou, se MYSQL_CONTAINER estiver definido,
 * dentro do container (docker exec). A senha vai por variável de ambiente.
 */
export function sql(q, { semBanco = false } = {}) {
  const args = [`-u${usuario}`, "-N", "--default-character-set=utf8mb4", ...(semBanco ? [] : [NOME_BANCO]), "-e", q];
  const opcoes = { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, MYSQL_PWD: senha } };
  const container = process.env.MYSQL_CONTAINER;
  const saida = container
    ? execFileSync("docker", ["exec", "-e", `MYSQL_PWD=${senha}`, container, "mysql", ...args], opcoes)
    : execFileSync("mysql", ["-h", banco.hostname, "-P", banco.port || "3306", "--protocol=TCP", ...args], opcoes);
  return saida.toString("utf8").trim();
}

export async function req(method, path, token, body, headers = {}) {
  const ehForm = body instanceof FormData;
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(ehForm ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? (ehForm ? body : JSON.stringify(body)) : undefined,
  });
  const tipo = r.headers.get("content-type") ?? "";
  const corpo = tipo.includes("json") ? await r.json() : await r.text();
  // Envelope da API v1: sucesso { data }, erro { error: { code, message } }.
  // Para os testes, "data" é o conteúdo e erros ficam em { erro, code } (formato legado dos scripts).
  let data = corpo;
  if (corpo && typeof corpo === "object" && "data" in corpo) data = corpo.data;
  else if (corpo && typeof corpo === "object" && corpo.error) data = { erro: corpo.error.message, code: corpo.error.code, detalhes: corpo.error.details, requestId: corpo.error.requestId };
  return { status: r.status, data, corpo, headers: r.headers };
}

export async function login(email, senha = "123456") {
  const r = await req("POST", "/auth/login", null, { email, senha });
  if (r.status !== 200) throw new Error(`login ${email} falhou: ${JSON.stringify(r.data)}`);
  return r.data.accessToken;
}

let falhas = 0;
let total = 0;
export function ok(cond, msg, extra) {
  total++;
  if (!cond) falhas++;
  console.log(`${cond ? "✅" : "❌"} ${msg}${!cond && extra !== undefined ? "  → " + JSON.stringify(extra).slice(0, 400) : ""}`);
}
export function resultado() {
  console.log(falhas ? `\n${falhas} de ${total} falharam` : `\nTodas as ${total} checagens passaram.`);
  return falhas;
}

export function hojeISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Remove tudo que os testes criam (prefixo TST / e-mails tst.*). Ordem respeita as FKs. */
export function limparTST() {
  const passos = [
    "DELETE c FROM checkins c JOIN viagens v ON v.id=c.viagemId JOIN onibus o ON o.id=v.onibusId WHERE o.placa LIKE 'TST-%'",
    "DELETE c FROM checkins c JOIN alunos a ON a.id=c.alunoId JOIN usuarios u ON u.id=a.usuarioId WHERE u.email LIKE 'tst.%'",
    "DELETE v FROM viagens v JOIN onibus o ON o.id=v.onibusId WHERE o.placa LIKE 'TST-%'",
    "DELETE a FROM auditorias a JOIN alunos al ON al.id=a.entidadeId JOIN usuarios u ON u.id=al.usuarioId WHERE u.email LIKE 'tst.%'",
    "DELETE FROM notificacoes WHERE mensagem LIKE '%TST%'",
    // Programações referenciam ônibus e motorista: saem antes dos usuários
    "DELETE p FROM programacoes p JOIN rotas r ON r.id=p.rotaId WHERE r.nome LIKE 'TST %'",
    "DELETE FROM usuarios WHERE email LIKE 'tst.%@buson.com'",
    "DELETE FROM rotas WHERE nome LIKE 'TST %'",
    "DELETE FROM pontos_embarque WHERE nome LIKE 'TST %'",
    "DELETE FROM onibus WHERE placa LIKE 'TST-%'",
    "DELETE FROM universidades WHERE nome LIKE 'TST %'",
    // Sessões abertas pelos testes (fetch do Node) e auditorias de entidades TST
    "DELETE FROM refresh_tokens WHERE userAgent = 'node' OR deviceId LIKE 'tst-%'",
    // Aparelhos de push dos testes (inclusive os registrados para o admin)
    "DELETE FROM dispositivos_push WHERE token LIKE '%[tst-%'",
    "DELETE FROM auditorias WHERE CAST(valorNovo AS CHAR) LIKE '%TST%' OR CAST(valorAnterior AS CHAR) LIKE '%TST%'",
  ];
  for (const p of passos) {
    try {
      sql(p);
    } catch {
      /* tabela ainda não existe numa fase anterior */
    }
  }
}
