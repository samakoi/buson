// Testa as melhorias criando dados próprios (prefixo TST) e removendo só eles no final.
import { BASE as B, sql } from "./lib.mjs";

async function req(method, path, token, body) {
  const r = await fetch(B + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  const corpo = txt ? JSON.parse(txt) : null;
  // Envelope v1: desembrulha { data } e traduz { error } para { erro, code }
  const data = corpo && "data" in corpo ? corpo.data : corpo?.error ? { erro: corpo.error.message, code: corpo.error.code } : corpo;
  return { status: r.status, data };
}
const login = async (email, senha = "123456") => (await req("POST", "/auth/login", null, { email, senha })).data.accessToken;
let falhas = 0;
const ok = (cond, msg, extra) => { if (!cond) falhas++; console.log(`${cond ? "✅" : "❌"} ${msg}${!cond && extra !== undefined ? "  → " + JSON.stringify(extra) : ""}`); };
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const ontem = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();

function limpar() {
  sql([
    "DELETE c FROM checkins c JOIN viagens v ON v.id=c.viagemId JOIN onibus o ON o.id=v.onibusId WHERE o.placa LIKE 'TST-%'",
    "DELETE v FROM viagens v JOIN onibus o ON o.id=v.onibusId WHERE o.placa LIKE 'TST-%'",
    "DELETE FROM rotas WHERE nome LIKE 'TST %'",
    "DELETE FROM usuarios WHERE email LIKE 'tst.%@buson.com'",
    "DELETE FROM onibus WHERE placa LIKE 'TST-%'",
  ].join("; "));
}
limpar();

const adm = await login("admin@buson.com");
const facimp = (await req("GET", "/universidades")).data.find((u) => u.nome === "FACIMP").id;

// ---- Cadastros do admin
const bus = await req("POST", "/onibus", adm, { placa: "tst-0001", capacidade: 3 });
ok(bus.status === 201 && bus.data.placa === "TST-0001", "cria ônibus (placa em maiúsculas)", bus);
const dup = await req("POST", "/onibus", adm, { placa: "TST-0001", capacidade: 3 });
ok(dup.status === 409, "placa duplicada → 409 com mensagem clara", dup);
const mot = await req("POST", "/motoristas", adm, { nome: "TST Motorista", email: "tst.motorista@buson.com", senha: "123456", onibusId: bus.data.id });
ok(mot.status === 201 && mot.data.onibus.placa === "TST-0001", "cria motorista vinculado ao ônibus", mot);
ok(!JSON.stringify((await req("GET", "/motoristas", adm)).data).includes("senhaHash"), "lista de motoristas não vaza senhaHash");
const rota = await req("POST", "/rotas", adm, { nome: "TST Rota", universidadeIds: [facimp] });
ok(rota.status === 201 && rota.data.pontos[0].ordem === 1, "cria rota com ordem automática", rota);
ok((await req("POST", "/rotas", adm, { nome: "TST Rota 2", universidadeIds: [facimp, facimp] })).status === 400, "rota com universidade repetida → 400");

const base = { rotaId: rota.data.id, onibusId: bus.data.id, motoristaId: mot.data.id, data: hoje, horario: "23:50" };
const muitas = await req("POST", "/viagens", adm, { ...base, vagas: 5 });
ok(muitas.status === 400 && /3 lugares/.test(muitas.data.erro), "vagas acima da capacidade → 400", muitas);
ok((await req("POST", "/viagens", adm, { ...base, data: ontem })).status === 400, "viagem em data passada → 400");
const horaRuim = await req("POST", "/viagens", adm, { ...base, horario: "25:00" });
ok(horaRuim.status === 400 && horaRuim.data.erro.includes("HH:MM"), "horário inválido → mensagem em português", horaRuim);
const viagem = await req("POST", "/viagens", adm, base);
ok(viagem.status === 201 && viagem.data.vagas === 3, "cria viagem com vagas = capacidade do ônibus", viagem);
const viagemId = viagem.data.id;
ok((await req("GET", `/viagens?desde=${hoje}`, adm)).data.some((v) => v.id === viagemId && v.resumo), "admin lista viagens desde hoje com resumo");

// ---- Alunos: cadastro, vagas restantes, posição na fila
const alunos = [];
for (let i = 0; i < 4; i++) {
  const email = `tst.aluno${i}@buson.com`;
  const cad = await req("POST", "/auth/cadastro", null, { nome: `TST Aluno ${i}`, email: ` ${email.toUpperCase()} `, senha: "123456", universidadeId: facimp });
  if (i === 0) ok(cad.status === 201 && cad.data.email === email, "cadastro normaliza o e-mail", cad);
  alunos.push(await login(email));
}
const cadRuim = await req("POST", "/auth/cadastro", null, { nome: "X", email: "x", senha: "1", universidadeId: facimp });
ok(cadRuim.status === 400 && /nome|e-mail|senha/i.test(cadRuim.data.erro), "cadastro inválido → mensagem em português", cadRuim);

for (const t of alunos) await req("POST", `/viagens/${viagemId}/checkin`, t);
const minha = (t) => req("GET", "/viagens", t).then((r) => r.data.find((v) => v.id === viagemId));
const v0 = await minha(alunos[0]);
ok(v0.vagasRestantes === 0 && v0.resumo.confirmados === 3 && v0.resumo.espera === 1, "resumo: 3 confirmados, 1 na espera, 0 vagas", v0 && { r: v0.resumo, vr: v0.vagasRestantes });
const v3 = await minha(alunos[3]);
ok(v3.meuCheckin.status === "ESPERA" && v3.meuCheckin.posicaoFila === 1, "aluno na espera vê posição 1 na fila", v3.meuCheckin);
ok(v0.meuCheckin.posicaoFila === null, "confirmado não tem posição na fila");

// ---- Manutenção + notificações
const motT = await login("tst.motorista@buson.com");
const antes = (await req("GET", "/notificacoes", alunos[3])).data;
const man = await req("PATCH", `/onibus/${bus.data.id}/manutencao`, adm, { emManutencao: true, observacao: "Troca de pneus" });
ok(man.status === 200 && man.data.emManutencao, "admin coloca ônibus em manutenção", man);
const status = (await req("GET", "/onibus/status", alunos[0])).data.find((o) => o.placa === "TST-0001");
ok(status.emManutencao && status.observacaoManutencao === "Troca de pneus", "aluno vê o status de manutenção da frota", status);
ok((await minha(alunos[0])).onibus.emManutencao === true, "viagem do aluno mostra ônibus em manutenção");
const depois = (await req("GET", "/notificacoes", alunos[3])).data;
ok(depois.naoLidas === antes.naoLidas + 1 && depois.itens[0].mensagem.includes("manutenção"), "aluno afetado recebe notificação de manutenção", depois.itens[0]);
const ini = await req("POST", `/viagens/${viagemId}/iniciar`, motT);
ok(ini.status === 409 && ini.data.erro.includes("manutenção"), "motorista não inicia viagem com ônibus em manutenção", ini);
await req("PATCH", `/onibus/${bus.data.id}/manutencao`, adm, { emManutencao: false });
ok((await req("GET", "/notificacoes", alunos[3])).data.itens[0].mensagem.includes("voltou a operar"), "aluno é avisado quando sai da manutenção");
await req("POST", "/notificacoes/lidas", alunos[3]);
ok((await req("GET", "/notificacoes", alunos[3])).data.naoLidas === 0, "marcar como lidas zera o contador");
ok((await req("GET", "/notificacoes", motT)).status === 200, "motorista acessa os próprios avisos (3 perfis)");

// ---- Embarque devolve o nome do aluno
ok((await req("POST", `/viagens/${viagemId}/iniciar`, motT)).status === 200, "inicia viagem após manutenção");
// Embarque pelo QR temporário do motorista (Fase 1 da evolução)
const sessao = (await req("POST", `/viagens/${viagemId}/embarque/sessao`, motT)).data;
const token = sessao.conteudoQr.split(".").slice(2).join(".");
const emb = await req("POST", `/viagens/${viagemId}/embarque/scan`, alunos[0], { token });
ok(emb.status === 201 && emb.data.viagem.onibus === "TST-0001", "aluno embarca escaneando o QR do motorista", emb);
const embEspera = await req("POST", `/viagens/${viagemId}/embarque/scan`, alunos[3], { token });
ok(embEspera.status === 400 && embEspera.data.code === "SEM_VAGA_CONFIRMADA", "aluno da lista de espera não embarca", embEspera);
ok((await req("GET", "/viagens/atual", motT)).data.resumo.embarcados === 1, "painel do motorista: 1 embarcado");

// ---- Relatório: pendentes antes de encerrar, faltas depois
let rel = (await req("GET", `/dashboard/relatorio?inicio=${hoje}&fim=${hoje}`, adm)).data;
let minhaRel = rel.viagens.find((v) => v.id === viagemId);
ok(minhaRel.faltas === 0 && rel.totais.pendentes >= 2, "antes de encerrar: não embarcados são pendentes, não faltas", { minhaRel, t: rel.totais });
await req("POST", `/viagens/${viagemId}/encerrar`, motT);
rel = (await req("GET", `/dashboard/relatorio?inicio=${hoje}&fim=${hoje}`, adm)).data;
minhaRel = rel.viagens.find((v) => v.id === viagemId);
const faltasMinhas = rel.faltas.filter((f) => f.viagemId === viagemId).map((f) => f.aluno).sort();
ok(minhaRel.faltas === 2 && faltasMinhas.join() === "TST Aluno 1,TST Aluno 2", "depois de encerrar: 2 faltas (quem estava na espera não conta)", faltasMinhas);
ok(rel.porDia.length === 1 && rel.porDia[0].faltas >= 2 && rel.faltasPorUniversidade.FACIMP >= 2, "faltas agregadas por dia e por universidade", rel.porDia);
ok(typeof rel.totais.taxaPresenca === "number", "taxa de presença calculada com viagens encerradas", rel.totais);
const semana = (await req("GET", `/dashboard/relatorio?inicio=${ontem}&fim=${hoje}`, adm)).data;
ok(semana.porDia.length === 2 && semana.periodo.dias === 2, "filtro por período devolve um ponto por dia", semana.periodo);
ok((await req("GET", `/dashboard/relatorio?inicio=${hoje}&fim=${ontem}`, adm)).status === 400, "período invertido → 400");
ok((await req("GET", `/dashboard/relatorio?inicio=2020-01-01&fim=${hoje}`, adm)).status === 400, "período maior que 366 dias → 400");
ok((await req("GET", `/dashboard/relatorio?inicio=2026-02-30`, adm)).status === 400, "data inexistente → 400");

// ---- Exclusões protegidas
ok((await req("DELETE", `/viagens/${viagemId}`, adm)).status === 409, "não exclui viagem encerrada");
const delBus = await req("DELETE", `/onibus/${bus.data.id}`, adm);
ok(delBus.status === 409 && delBus.data.erro.includes("em uso"), "não exclui ônibus com viagens (409, não 500)", delBus);
ok((await req("DELETE", `/motoristas/${mot.data.id}`, adm)).status === 409, "não exclui motorista com viagens");
const v2 = await req("POST", "/viagens", adm, { ...base, horario: "23:55" });
await req("POST", `/viagens/${v2.data.id}/checkin`, alunos[1]);
ok((await req("DELETE", `/viagens/${v2.data.id}`, adm)).status === 200, "exclui viagem que ainda não começou");
ok((await req("GET", "/notificacoes", alunos[1])).data.itens[0].mensagem.includes("cancelada"), "aluno é avisado do cancelamento da viagem");

limpar();
console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo. Dados de teste removidos.");
