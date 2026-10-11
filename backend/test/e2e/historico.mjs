// Fase 11 — Histórico de viagens (administração): lista paginada com filtros e totais, e o detalhe da viagem
import { hojeISO, limparTST, login, ok, req, resultado, SENHA_TST, sql } from "./lib.mjs";

limparTST();
const adm = await login("admin@buson.com");

const uni = (await req("POST", "/universidades", adm, { nome: "TST Inst Hist" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-HIS1", capacidade: 3 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista Hist", email: "tst.motohist@buson.com", senha: SENHA_TST, onibusId: bus.id });
const motId = (await req("GET", "/motoristas", adm)).data.find((m) => m.usuario.email === "tst.motohist@buson.com").id;
const mot = await login("tst.motohist@buson.com");
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota Hist", universidadeIds: [uni.id] })).data;
async function aluno(nome, email) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: SENHA_TST, universidadeId: uni.id });
  const token = await login(email);
  return { token, id: (await req("GET", "/alunos/me", token)).data.id };
}
const ana = await aluno("TST Ana Hist", "tst.anahist@buson.com");
const beto = await aluno("TST Beto Hist", "tst.betohist@buson.com");
const caio = await aluno("TST Caio Hist", "tst.caiohist@buson.com");
const davi = await aluno("TST Davi Hist", "tst.davihist@buson.com");

// Viagem de hoje com 3 vagas: Ana embarca, Beto falta, Caio avisa que não vai, Davi fica na espera (e sobe)
const v = (
  await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: motId, data: hojeISO(), horario: "23:50", vagas: 3 })
).data;
for (const a of [ana, beto, caio, davi]) await req("POST", `/viagens/${v.id}/checkin`, a.token);
await req("POST", `/viagens/${v.id}/checkin/cancelar`, caio.token, { motivo: "DOENCA" });
const iniciada = await req("POST", `/viagens/${v.id}/iniciar`, mot);
ok(iniciada.status === 200, "motorista inicia a viagem", iniciada.data);
ok(
  sql(`SELECT iniciadaEm IS NOT NULL AND encerradaEm IS NULL FROM viagens WHERE id='${v.id}'`) === "1",
  "início da viagem fica registrado"
);
await req("POST", `/viagens/${v.id}/embarque/manual`, mot, { alunoId: ana.id });
await req("POST", `/viagens/${v.id}/encerrar`, mot);
ok(sql(`SELECT encerradaEm >= iniciadaEm FROM viagens WHERE id='${v.id}'`) === "1", "fim da viagem fica registrado");

// Uma viagem antiga (sem horários de início e fim) há 10 dias
const antiga = (
  await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: motId, data: hojeISO(), horario: "05:00" })
).data;
sql(`UPDATE viagens SET data = DATE_SUB(data, INTERVAL 10 DAY), status='ENCERRADA' WHERE id='${antiga.id}'`);

// ---- Lista
const doTeste = (itens) => itens.filter((x) => x.rota.nome === "TST Rota Hist");
const padrao = await req("GET", `/viagens/historico?rotaId=${rota.id}`, adm);
ok(padrao.status === 200 && padrao.data.periodo.fim === hojeISO(), "padrão: até hoje", padrao.data.periodo);
ok(
  padrao.data.total === 2 && doTeste(padrao.data.itens).length === 2,
  "padrão de 30 dias inclui a viagem de 10 dias atrás",
  padrao.data.total
);
ok(padrao.data.itens[0].id === v.id, "mais recentes primeiro");
const resumo = padrao.data.itens[0].resumo;
ok(resumo.embarcados === 1 && resumo.faltas === 2, "resumo com embarques e faltas da viagem", resumo);
ok(
  padrao.data.totais.viagens === 2 && padrao.data.totais.embarcados === 1 && padrao.data.totais.faltas === 2,
  "totais do período",
  padrao.data.totais
);

const semana = await req("GET", `/viagens/historico?rotaId=${rota.id}&inicio=${hojeISO(-6)}&fim=${hojeISO()}`, adm);
ok(semana.data.total === 1, "período de 7 dias deixa a viagem antiga de fora", semana.data.total);
const pagina = await req("GET", `/viagens/historico?rotaId=${rota.id}&porPagina=1&pagina=2`, adm);
ok(pagina.data.itens.length === 1 && pagina.data.itens[0].id === antiga.id && pagina.data.total === 2, "paginação", pagina.data);
ok((await req("GET", `/viagens/historico?rotaId=${rota.id}&sentido=VOLTA`, adm)).data.total === 0, "filtro por sentido");
ok((await req("GET", `/viagens/historico?motoristaId=${motId}&status=ENCERRADA`, adm)).data.total === 2, "filtro por motorista e situação");
ok(
  (await req("GET", `/viagens/historico?inicio=${hojeISO()}&fim=${hojeISO(-1)}`, adm)).data.code === "PERIODO_INVALIDO",
  "período invertido é recusado"
);
ok(
  (await req("GET", `/viagens/historico?inicio=2020-01-01&fim=${hojeISO()}`, adm)).data.code === "PERIODO_MUITO_LONGO",
  "período longo demais é recusado"
);
ok((await req("GET", "/viagens/historico?porPagina=500", adm)).data.code === "VALIDACAO", "no máximo 50 por página");
ok((await req("GET", "/viagens/historico", ana.token)).status === 403, "aluno não vê o histórico");
ok((await req("GET", "/viagens/historico", mot)).status === 403, "motorista não vê o histórico");

// ---- Detalhe
const d = await req("GET", `/viagens/${v.id}/detalhe`, adm);
ok(
  d.status === 200 && d.data.viagem.iniciadaEm && d.data.viagem.encerradaEm && d.data.viagem.avulsa === true,
  "detalhe com horários",
  d.data.viagem
);
const sit = Object.fromEntries(d.data.passageiros.map((p) => [p.nome, p.situacao]));
ok(
  sit["TST Ana Hist"] === "EMBARCOU" &&
    sit["TST Beto Hist"] === "FALTOU" &&
    sit["TST Caio Hist"] === "AUSENCIA_AVISADA" &&
    sit["TST Davi Hist"] === "FALTOU",
  "situação de cada passageiro (Davi subiu da espera e faltou)",
  sit
);
ok(d.data.passageiros[0].situacao === "EMBARCOU" && d.data.passageiros[0].metodoEmbarque === "MANUAL", "embarcados primeiro, com o método");
ok(d.data.passageiros.find((p) => p.nome === "TST Caio Hist").motivoAusencia === "DOENCA", "motivo da ausência avisada");
ok(
  d.data.resumo.embarcaram === 1 && d.data.resumo.faltaram === 2 && d.data.resumo.ausenciasAvisadas === 1,
  "números do detalhe",
  d.data.resumo
);
ok(d.data.gps.pontos === 0, "sem GPS, sem trajeto");
const dAntiga = await req("GET", `/viagens/${antiga.id}/detalhe`, adm);
ok(dAntiga.data.viagem.iniciadaEm === null && dAntiga.data.passageiros.length === 0, "viagem antiga sem horários registrados");
ok((await req("GET", `/viagens/${v.id}/detalhe`, mot)).status === 403, "motorista não abre o detalhe da administração");
ok(
  (await req("GET", "/viagens/00000000-0000-0000-0000-000000000000/detalhe", adm)).data.code === "VIAGEM_NAO_ENCONTRADA",
  "viagem inexistente"
);

const falhas = resultado();
limparTST();
process.exit(falhas ? 1 : 0);
