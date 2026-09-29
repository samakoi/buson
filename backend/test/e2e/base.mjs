// Fase 0 — base técnica: API v1, formato de resposta, erros, segurança, sessões, permissões, auditoria
import { BASE, hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

const RAIZ = BASE.replace(/\/api\/v1$/, "");
limparTST();

// ---- Formato de resposta, requestId, saúde
const raiz = await fetch(`${BASE}/`);
const raizJson = await raiz.json();
ok(raiz.status === 200 && raizJson.data?.api === "v1", "GET /api/v1 responde { data } com a versão", raizJson);
ok(/^[0-9a-f-]{36}$/.test(raiz.headers.get("x-request-id") ?? ""), "toda resposta traz X-Request-Id");
const eco = await fetch(`${BASE}/`, { headers: { "X-Request-Id": "tst-rastreio-123" } });
ok(eco.headers.get("x-request-id") === "tst-rastreio-123", "X-Request-Id recebido é reaproveitado (rastreio ponta a ponta)");
const saude = await req("GET", "/saude");
ok(saude.status === 200 && saude.data.banco === "ok", "GET /saude confirma API e banco", saude.data);

// ---- 404 e rotas antigas
const antiga = await fetch(`${RAIZ}/api/viagens`);
const antigaJson = await antiga.json();
ok(antiga.status === 404 && antigaJson.error?.code === "ROTA_NAO_ENCONTRADA", "rota antiga /api/... não existe mais (404 padronizado)", antigaJson);
const inexistente = await req("GET", "/nao-existe");
ok(inexistente.status === 404 && inexistente.data.code === "ROTA_NAO_ENCONTRADA" && inexistente.data.requestId, "404 com código e requestId", inexistente.data);

// ---- Cabeçalhos de segurança
ok(raiz.headers.get("x-content-type-options") === "nosniff" && !raiz.headers.get("x-powered-by"), "Helmet ativo e X-Powered-By removido");

// ---- CORS
const permitida = await fetch(`${BASE}/`, { headers: { Origin: "http://localhost:8083" } });
ok(permitida.headers.get("access-control-allow-origin") === "http://localhost:8083", "origem web configurada é aceita");
const bloqueada = await fetch(`${BASE}/`, { headers: { Origin: "https://site-malicioso.com" } });
const bloqueadaJson = await bloqueada.json();
ok(bloqueada.status === 403 && bloqueadaJson.error?.code === "ORIGEM_NAO_PERMITIDA", "origem desconhecida é bloqueada", bloqueadaJson);
ok((await fetch(`${BASE}/`)).status === 200, "app nativo (sem Origin) continua funcionando");

// ---- Códigos de erro
const senhaErrada = await req("POST", "/auth/login", null, { email: "admin@buson.com", senha: "errada" });
const emailInexistente = await req("POST", "/auth/login", null, { email: "tst.ninguem@buson.com", senha: "qualquer" });
ok(senhaErrada.status === 401 && senhaErrada.data.code === "CREDENCIAIS_INVALIDAS", "senha errada → CREDENCIAIS_INVALIDAS", senhaErrada.data);
ok(emailInexistente.data.code === senhaErrada.data.code && emailInexistente.data.erro === senhaErrada.data.erro, "e-mail inexistente responde igual (não revela quem tem conta)");
ok((await req("GET", "/auth/me")).data.code === "NAO_AUTENTICADO", "sem token → NAO_AUTENTICADO");
ok((await req("GET", "/auth/me", "token-falso")).data.code === "TOKEN_INVALIDO", "token inválido → TOKEN_INVALIDO");
const validacao = await req("POST", "/auth/login", null, { email: "invalido" });
ok(validacao.status === 400 && validacao.data.code === "VALIDACAO" && validacao.data.detalhes, "entrada inválida → VALIDACAO com detalhes", validacao.data);
const jsonRuim = await fetch(`${BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{ruim" });
ok(jsonRuim.status === 400 && (await jsonRuim.json()).error.code === "VALIDACAO", "JSON malformado → 400 (não 500)");

// ---- Permissões por ação
const adm = await login("admin@buson.com");
const mot = await login("motorista@buson.com");
const aluno = await login("aluno@buson.com");
ok((await req("GET", "/alunos", aluno)).data.code === "SEM_PERMISSAO", "aluno não lista alunos → SEM_PERMISSAO");
ok((await req("POST", "/viagens", mot, {})).data.code === "SEM_PERMISSAO", "motorista não cria viagens → SEM_PERMISSAO");
ok((await req("GET", "/dashboard/resumo", mot)).status === 403, "motorista não acessa o dashboard");
ok((await req("GET", "/dashboard/resumo", adm)).status === 200, "admin acessa o dashboard");

// ---- Sessões: rotação, reuso, logout por dispositivo e de todos
await req("POST", "/auth/cadastro", null, { nome: "TST Sessao", email: "tst.sessao@buson.com", senha: "123456", universidadeId: sql("SELECT id FROM universidades LIMIT 1") });
const loginA = (await req("POST", "/auth/login", null, { email: "tst.sessao@buson.com", senha: "123456", deviceId: "tst-celular-a" })).data;
ok(loginA.refreshToken?.length > 40 && !loginA.refreshToken.includes("."), "refresh token é opaco (não é JWT)");
ok(sql(`SELECT COUNT(*) FROM refresh_tokens WHERE tokenHash = SHA2('${loginA.refreshToken}', 256)`) === "1", "banco guarda só o hash do refresh token");
const r1 = await req("POST", "/auth/refresh", null, { refreshToken: loginA.refreshToken });
ok(r1.status === 200 && r1.data.accessToken && r1.data.refreshToken && r1.data.refreshToken !== loginA.refreshToken, "refresh devolve um NOVO par (rotação)", r1.data);
const reuso = await req("POST", "/auth/refresh", null, { refreshToken: loginA.refreshToken });
ok(reuso.status === 401 && reuso.data.code === "SESSAO_REVOGADA", "reusar token antigo → SESSAO_REVOGADA", reuso.data);
const aposReuso = await req("POST", "/auth/refresh", null, { refreshToken: r1.data.refreshToken });
ok(aposReuso.status === 401, "reuso derruba também a sessão nova do dispositivo (proteção contra roubo)", aposReuso.data);

const loginX = (await req("POST", "/auth/login", null, { email: "tst.sessao@buson.com", senha: "123456", deviceId: "tst-corrida" })).data;
const [c1, c2] = await Promise.all([1, 2].map(() => req("POST", "/auth/refresh", null, { refreshToken: loginX.refreshToken })));
ok([c1.status, c2.status].filter((s) => s === 200).length === 1, "duas renovações simultâneas do mesmo token: só uma vence", [c1.status, c2.status]);

const loginB = (await req("POST", "/auth/login", null, { email: "tst.sessao@buson.com", senha: "123456", deviceId: "tst-tablet-b" })).data;
const loginC = (await req("POST", "/auth/login", null, { email: "tst.sessao@buson.com", senha: "123456", deviceId: "tst-pc-c" })).data;
const sessoes = await req("GET", "/auth/sessoes", loginC.accessToken);
ok(sessoes.status === 200 && sessoes.data.length === 2 && sessoes.data.every((s) => !("tokenHash" in s)), "lista sessões ativas sem expor o token", sessoes.data);
const sessaoB = sessoes.data.find((s) => s.deviceId === "tst-tablet-b");
ok((await req("DELETE", `/auth/sessoes/${sessaoB.id}`, loginC.accessToken)).status === 204, "encerra a sessão de outro aparelho");
ok((await req("POST", "/auth/refresh", null, { refreshToken: loginB.refreshToken })).status === 401, "aparelho encerrado não renova mais");
ok((await req("POST", "/auth/logout", null, { refreshToken: loginC.refreshToken })).status === 204, "logout deste aparelho");
ok((await req("POST", "/auth/refresh", null, { refreshToken: loginC.refreshToken })).status === 401, "após logout o refresh falha");
const d1 = (await req("POST", "/auth/login", null, { email: "tst.sessao@buson.com", senha: "123456", deviceId: "tst-d1" })).data;
const d2 = (await req("POST", "/auth/login", null, { email: "tst.sessao@buson.com", senha: "123456", deviceId: "tst-d2" })).data;
const todos = await req("POST", "/auth/logout-todos", d1.accessToken);
ok(todos.status === 200 && todos.data.sessoesEncerradas === 2, "logout de todos os aparelhos", todos.data);
ok((await req("POST", "/auth/refresh", null, { refreshToken: d2.refreshToken })).status === 401, "nenhum aparelho renova após 'sair de todos'");
ok((await req("DELETE", "/auth/sessoes/00000000-0000-0000-0000-000000000000", d1.accessToken)).data.code === "SESSAO_NAO_ENCONTRADA", "encerrar sessão inexistente → SESSAO_NAO_ENCONTRADA");

// ---- Auditoria com valor anterior e novo
const bus = (await req("POST", "/onibus", adm, { placa: "TST-F0A", capacidade: 10 })).data;
await req("PATCH", `/onibus/${bus.id}`, adm, { capacidade: 20 });
const alt = sql(`SELECT JSON_EXTRACT(valorAnterior,'$.capacidade'), JSON_EXTRACT(valorNovo,'$.capacidade'), usuarioId IS NOT NULL FROM auditorias WHERE entidadeId='${bus.id}' AND acao='ONIBUS_ALTERADO'`);
ok(alt === "10\t20\t1", "alteração do ônibus registra antes (10), depois (20) e autor", alt);
await req("PATCH", `/onibus/${bus.id}/manutencao`, adm, { emManutencao: true, observacao: "TST revisão" });
ok(sql(`SELECT COUNT(*) FROM auditorias WHERE entidadeId='${bus.id}' AND acao='ONIBUS_EM_MANUTENCAO'`) === "1", "manutenção é auditada");
await req("PATCH", `/onibus/${bus.id}/manutencao`, adm, { emManutencao: false });
const moto = (await req("POST", "/motoristas", adm, { nome: "TST Motorista F0", email: "tst.motof0@buson.com", senha: "123456" })).data;
const uni = (await req("POST", "/universidades", adm, { nome: "TST Instituicao F0" })).data;
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota F0", universidadeIds: [uni.id] })).data;
const viagem = (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: moto.id, data: hojeISO(1), horario: "07:00" })).data;
await req("DELETE", `/viagens/${viagem.id}`, adm);
const acoes = sql(`SELECT GROUP_CONCAT(DISTINCT acao ORDER BY acao) FROM auditorias WHERE entidadeId IN ('${moto.id}','${uni.id}','${rota.id}','${viagem.id}')`);
ok(acoes === "INSTITUICAO_CADASTRADA,MOTORISTA_CADASTRADO,ROTA_CADASTRADA,VIAGEM_CANCELADA,VIAGEM_CRIADA", "cadastros e cancelamento de viagem são auditados", acoes);
await req("DELETE", `/onibus/${bus.id}`, adm);
ok(sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(valorAnterior,'$.placa')) FROM auditorias WHERE entidadeId='${bus.id}' AND acao='ONIBUS_REMOVIDO'`) === "TST-F0A", "remoção guarda o valor anterior");

// ---- Mesma situação = mesmo código e mesma mensagem
const v2 = (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: sql("SELECT id FROM onibus WHERE placa NOT LIKE 'TST-%' LIMIT 1"), motoristaId: moto.id, data: hojeISO(1), horario: "08:00" })).data;
const aluno2 = await login("aluno@buson.com");
const fora = await req("POST", `/viagens/${v2.id}/checkin/cancelar`, aluno2);
ok(fora.data.code === "CHECKIN_NAO_ENCONTRADO", "cancelar sem check-in → CHECKIN_NAO_ENCONTRADO", fora.data);
await req("DELETE", `/viagens/${v2.id}`, adm);

limparTST();
ok(sql("SELECT COUNT(*) FROM usuarios WHERE email LIKE 'tst.%'") === "0" && sql("SELECT COUNT(*) FROM refresh_tokens WHERE deviceId LIKE 'tst-%'") === "0", "dados e sessões de teste removidos");
process.exit(resultado());
