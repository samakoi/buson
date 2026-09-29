// Fase 2 (evolução) — alocação: pontos de embarque, programação semanal, dias do aluno e capacidade por dia
import { hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

limparTST();
const adm = await login("admin@buson.com");
const NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const diaSemana = (offset) => new Date(`${hojeISO(offset)}T12:00:00`).getDay();
const [d1, d2, d3, d4, d5] = [1, 2, 3, 4, 5].map(diaSemana); // amanhã … daqui a 5 dias (dias diferentes)

// ---- Cadastros base
const uniA = (await req("POST", "/universidades", adm, { nome: "TST Inst A" })).data;
const uniB = (await req("POST", "/universidades", adm, { nome: "TST Inst B" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-AL1", capacidade: 3 })).data;
const bus2 = (await req("POST", "/onibus", adm, { placa: "TST-AL2", capacidade: 2 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista Al", email: "tst.motoal@buson.com", senha: "123456", onibusId: bus.id });
const motId = (await req("GET", "/motoristas", adm)).data.find((m) => m.usuario.email === "tst.motoal@buson.com").id;

// ---- Pontos de embarque
const p1 = await req("POST", "/pontos-embarque", adm, { nome: "TST Praça Central", endereco: "Centro" });
ok(p1.status === 201 && p1.data.ativo === true, "admin cadastra ponto de embarque", p1.data);
const p2 = (await req("POST", "/pontos-embarque", adm, { nome: "TST Bairro Novo" })).data;
const p3 = (await req("POST", "/pontos-embarque", adm, { nome: "TST Ponto Fora" })).data;
ok((await req("POST", "/pontos-embarque", adm, { nome: "TST Praça Central" })).data.code === "DUPLICADO", "nome de ponto repetido é recusado");

// ---- Rotas com pontos ordenados
const rotaR = await req("POST", "/rotas", adm, { nome: "TST Rota Al", universidadeIds: [uniA.id], pontosEmbarqueIds: [p2.id, p1.data.id] });
ok(rotaR.status === 201 && rotaR.data.pontosEmbarque.map((p) => p.pontoEmbarque.nome).join() === "TST Bairro Novo,TST Praça Central", "rota guarda os pontos na ordem", rotaR.data);
const rota = rotaR.data;
ok((await req("POST", "/rotas", adm, { nome: "TST Rota X", universidadeIds: [uniA.id], pontosEmbarqueIds: [p1.data.id, p1.data.id] })).status === 400, "ponto repetido na rota é recusado");
const rotaB = (await req("POST", "/rotas", adm, { nome: "TST Rota B", universidadeIds: [uniB.id] })).data;

// ---- Programação semanal
const todosDias = [0, 1, 2, 3, 4, 5, 6];
const progBase = { rotaId: rota.id, onibusId: bus.id, motoristaId: motId, horarioIda: "23:40", horarioVolta: "23:50", diasSemana: todosDias };
ok((await req("POST", "/programacoes", adm, { ...progBase, horarioVolta: "23:30" })).data.code === "HORARIO_VOLTA_INVALIDO", "volta antes da ida é recusada");
const progR = await req("POST", "/programacoes", adm, progBase);
ok(progR.status === 201 && progR.data.ocupacao.length === 7 && progR.data.ocupacao[0].capacidade === 3, "admin cria a programação (capacidade = ônibus)", progR.data);
const prog = progR.data;
ok((await req("POST", "/programacoes", adm, progBase)).data.code === "PROGRAMACAO_JA_ATIVA_NA_ROTA", "só uma programação ativa por rota");
const alunoTk = await (async () => {
  await req("POST", "/auth/cadastro", null, { nome: "TST Intruso", email: "tst.intruso@buson.com", senha: "123456", universidadeId: uniA.id });
  return login("tst.intruso@buson.com");
})();
ok((await req("POST", "/programacoes", alunoTk, progBase)).data.code === "SEM_PERMISSAO", "aluno não cria programação");

// O banco guarda UTC: o dia local da viagem vem da API (lista do admin)
const diaLocal = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const viagensDaProg = async () => (await req("GET", `/viagens?desde=${hojeISO()}`, adm)).data.filter((v) => v.programacaoId === prog.id);
const viagemDe = async (offset, sentido = "IDA") =>
  (await viagensDaProg()).find((v) => v.sentido === sentido && diaLocal(v.data) === hojeISO(offset))?.id ?? "";
const contarViagens = async () => (await viagensDaProg()).filter((v) => diaLocal(v.data) >= hojeISO(1)).length;
ok(await contarViagens() === 12, "a programação gera ida e volta dos próximos dias (6 dias × 2)", await contarViagens());

// ---- Alunos
async function novoAluno(nome, email, uni, ativar = true) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: "123456", universidadeId: uni });
  const token = await login(email);
  const id = (await req("GET", "/alunos/me", token)).data.id;
  if (ativar) await req("PATCH", `/alunos/${id}/status`, adm, { status: "ATIVO" });
  return { token, id };
}
const ana = await novoAluno("TST Ana", "tst.ana@buson.com", uniA.id);
const beto = await novoAluno("TST Beto", "tst.beto@buson.com", uniA.id);
const caio = await novoAluno("TST Caio", "tst.caio@buson.com", uniA.id);
const dani = await novoAluno("TST Dani", "tst.dani@buson.com", uniA.id);
const eva = await novoAluno("TST Eva", "tst.eva@buson.com", uniA.id);
const fabi = await novoAluno("TST Fabi", "tst.fabi@buson.com", uniA.id, false); // pendente
const gil = await novoAluno("TST Gil", "tst.gil@buson.com", uniB.id);
const dias = (...lista) => ({ dias: lista.map(([diaSemana, pontoEmbarqueId = null, rotaId = rota.id]) => ({ diaSemana, rotaId, pontoEmbarqueId })) });

ok((await req("PUT", "/alunos/me/dias", fabi.token, dias([d1]))).data.code === "CONTA_NAO_ATIVA", "conta pendente não escolhe dias");
ok((await req("PUT", "/alunos/me/dias", gil.token, dias([d1]))).data.code === "ROTA_NAO_ATENDE_INSTITUICAO", "rota que não passa pela instituição é recusada");
ok((await req("PUT", "/alunos/me/dias", ana.token, dias([d1, p3.id]))).data.code === "PONTO_FORA_DA_ROTA", "ponto que não é da rota é recusado");
ok((await req("PUT", "/alunos/me/dias", ana.token, dias([d1], [d1]))).data.code === "VALIDACAO", "dia repetido é recusado");
ok((await req("PUT", "/alunos/me/dias", gil.token, dias([d1, null, rotaB.id]))).data.code === "DIA_SEM_TRANSPORTE", "rota sem programação não aceita dias");

const anaDias = await req("PUT", "/alunos/me/dias", ana.token, dias([d1, p1.data.id], [d2, p1.data.id]));
ok(anaDias.status === 200 && anaDias.data.dias.length === 2 && anaDias.data.dias[0].pontoEmbarque, "aluno ativo escolhe dias e ponto", anaDias.data);
const opcaoR = anaDias.data.opcoes.find((o) => o.rota.id === rota.id);
ok(opcaoR && opcaoR.pontosEmbarque.length === 2 && opcaoR.dias.find((d) => d.diaSemana === d1).disponiveis === 3, "opções mostram pontos e vagas do dia (sem contar o próprio aluno)", opcaoR);
const idaD1 = await viagemDe(1);
const voltaD1 = await viagemDe(1, "VOLTA");
ok(sql(`SELECT status FROM checkins WHERE viagemId='${idaD1}' AND alunoId='${ana.id}'`) === "PROGRAMADO", "viagem de ida já gerada recebe o aluno como PROGRAMADO");
ok(sql(`SELECT status FROM checkins WHERE viagemId='${voltaD1}' AND alunoId='${ana.id}'`) === "PROGRAMADO", "e a volta do mesmo dia também");
ok(sql(`SELECT pontoEmbarqueId FROM checkins WHERE viagemId='${idaD1}' AND alunoId='${ana.id}'`) === p1.data.id, "check-in programado leva o ponto de embarque");

ok((await req("PUT", "/alunos/me/dias", beto.token, dias([d1]))).status === 200, "2º aluno no dia");
ok((await req("PUT", "/alunos/me/dias", caio.token, dias([d1]))).status === 200, "3º aluno no dia (lota)");
const lotado = await req("PUT", "/alunos/me/dias", dani.token, dias([d1], [d2]));
ok(lotado.status === 409 && lotado.data.code === "DIAS_LOTADOS" && lotado.data.detalhes.dias.join() === String(d1) && lotado.data.erro.includes(NOMES[d1]), "dia lotado é bloqueado e informado", lotado.data);
ok(Number(sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE alunoId='${dani.id}' AND ativo=1`)) === 0, "pedido com dia lotado não salva nada (tudo ou nada)");
ok((await req("PUT", "/alunos/me/dias", dani.token, dias([d2]))).status === 200, "aluno escolhe outro dia");

const ocup = (await req("GET", `/programacoes/${prog.id}/ocupacao`, adm)).data;
ok(ocup.find((o) => o.diaSemana === d1).alocados === 3 && ocup.find((o) => o.diaSemana === d1).disponiveis === 0 && ocup.find((o) => o.diaSemana === d2).alocados === 2, "ocupação por dia da programação", ocup);
const semanal = (await req("GET", "/dashboard/ocupacao-semanal", adm)).data;
const semanalR = semanal.rotas.find((r) => r.rota === "TST Rota Al");
ok(semanalR && semanalR.dias.find((d) => d.diaSemana === d1).alocados === 3 && semanal.dias.find((d) => d.diaSemana === d1).capacidade >= 3, "dashboard mostra a ocupação semanal", semanal);

// ---- Concorrência: 10 alunos pedindo o mesmo dia de 3 vagas ao mesmo tempo
const concorrentes = [];
for (let i = 0; i < 10; i++) concorrentes.push(await novoAluno(`TST Conc ${i}`, `tst.conc${i}@buson.com`, uniA.id));
const respostas = await Promise.all(concorrentes.map((c) => req("PUT", "/alunos/me/dias", c.token, dias([d3]))));
const aceitos = respostas.filter((r) => r.status === 200).length;
const recusados = respostas.filter((r) => r.data.code === "DIAS_LOTADOS").length;
ok(aceitos === 3 && recusados === 7, `10 pedidos simultâneos: 3 aceitos, 7 lotados (${aceitos}/${recusados})`, respostas.map((r) => r.data.code ?? r.status));
ok(Number(sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE rotaId='${rota.id}' AND diaSemana=${d3} AND ativo=1`)) === 3, "banco tem exatamente 3 alocados no dia");
ok(Number(sql(`SELECT COUNT(*) FROM checkins WHERE viagemId='${await viagemDe(3)}' AND status='PROGRAMADO'`)) === 3, "a viagem do dia tem 3 programados");

// ---- Troca de dia libera a vaga
ok((await req("PUT", "/alunos/me/dias", beto.token, dias([d4]))).status === 200, "aluno troca de dia");
ok(sql(`SELECT COUNT(*) FROM checkins WHERE viagemId='${idaD1}' AND alunoId='${beto.id}'`) === "0", "sai da viagem do dia antigo");
ok(sql(`SELECT status FROM checkins WHERE viagemId='${await viagemDe(4)}' AND alunoId='${beto.id}'`) === "PROGRAMADO", "entra na viagem do dia novo");
ok((await req("PUT", "/alunos/me/dias", dani.token, dias([d1], [d2]))).status === 200, "a vaga liberada pode ser ocupada");

// ---- Aluno inativo não conta
await req("PATCH", `/alunos/${caio.id}/status`, adm, { status: "INATIVO" });
ok(sql(`SELECT COUNT(*) FROM checkins WHERE viagemId='${idaD1}' AND alunoId='${caio.id}'`) === "0", "inativar tira o aluno das viagens programadas");
ok((await req("PUT", "/alunos/me/dias", eva.token, dias([d1]))).status === 200, "vaga de aluno inativo fica livre");
await req("PATCH", `/alunos/${caio.id}/status`, adm, { status: "ATIVO" });
const caioDias = (await req("GET", `/alunos/${caio.id}/dias`, adm)).data;
ok(caioDias.dias.length === 0, "reativado com o dia lotado: o dia é liberado", caioDias.dias);
ok(sql(`SELECT COUNT(*) FROM notificacoes n JOIN alunos a ON a.usuarioId=n.usuarioId WHERE a.id='${caio.id}' AND n.mensagem LIKE '%lotou%'`) === "1", "e o aluno é avisado para escolher outro dia");

// ---- Ajuste manual pelo admin
ok((await req("PUT", `/alunos/${caio.id}/dias`, adm, dias([d1]))).data.code === "DIAS_LOTADOS", "admin também respeita a capacidade");
ok((await req("PUT", `/alunos/${caio.id}/dias`, adm, dias([d5]))).status === 200, "admin define os dias do aluno");
ok(sql(`SELECT COUNT(*) FROM notificacoes n JOIN alunos a ON a.usuarioId=n.usuarioId WHERE a.id='${caio.id}' AND n.mensagem LIKE '%atualizou seus dias%'`) === "1", "aluno é avisado do ajuste manual");
ok((await req("PUT", `/alunos/${caio.id}/dias`, ana.token, dias([d5]))).data.code === "SEM_PERMISSAO", "aluno não mexe nos dias de outro");
ok(sql(`SELECT COUNT(*) FROM auditorias a JOIN usuarios u ON u.id=a.usuarioId WHERE a.entidadeId='${caio.id}' AND a.acao='DIAS_ALTERADOS' AND u.papel='ADMIN'`) === "1", "mudança de dias pelo admin fica auditada (com o autor)");

// ---- Geração idempotente
const antes = await contarViagens();
const g1 = (await req("POST", "/programacoes/gerar", adm)).data;
const g2 = (await req("POST", "/programacoes/gerar", adm)).data;
ok(g2.criadas === 0 && await contarViagens() === antes, "gerar de novo não duplica viagens", { g1, g2 });

// ---- Confirmação diária (PROGRAMADO → CONFIRMADO na ida e na volta)
const conf = await req("POST", `/viagens/${idaD1}/checkin`, ana.token);
ok(conf.status === 201 && conf.data.status === "CONFIRMADO", "aluno confirma a presença", conf.data);
ok(sql(`SELECT status FROM checkins WHERE viagemId='${voltaD1}' AND alunoId='${ana.id}'`) === "CONFIRMADO", "a confirmação vale para a volta do dia");
ok((await req("POST", `/viagens/${idaD1}/checkin`, ana.token)).data.code === "CHECKIN_JA_ATIVO", "confirmar de novo não duplica");

// ---- Vagas avulsas usam o que sobra
const idaD5 = await viagemDe(5);
ok((await req("POST", `/viagens/${idaD5}/checkin`, beto.token)).data.status === "CONFIRMADO", "avulso ocupa vaga que sobrou (1/3 alocado)");
ok((await req("POST", `/viagens/${idaD5}/checkin`, fabi.token)).data.status === "CONFIRMADO", "aluno pendente pode pedir vaga avulsa");
ok((await req("POST", `/viagens/${idaD5}/checkin`, concorrentes[9].token)).data.status === "ESPERA", "sem vaga: avulso vai para a espera");
await req("POST", `/viagens/${idaD5}/checkin/cancelar`, caio.token);
ok(sql(`SELECT status FROM checkins WHERE viagemId='${idaD5}' AND alunoId='${concorrentes[9].id}'`) === "CONFIRMADO", "programado que cancela libera a vaga para a espera");

// Dia com vaga na capacidade mas viagem cheia de avulsos: o novo alocado vai para a espera dessa viagem
ok((await req("PUT", "/alunos/me/dias", dani.token, dias([d1], [d2], [d5]))).status === 200, "alocação aceita (capacidade do dia comporta)");
ok(sql(`SELECT status FROM checkins WHERE viagemId='${idaD5}' AND alunoId='${dani.id}'`) === "ESPERA", "na viagem já cheia de avulsos, entra na espera");
ok(sql(`SELECT status FROM checkins WHERE viagemId='${await viagemDe(5, "VOLTA")}' AND alunoId='${dani.id}'`) === "PROGRAMADO", "na volta com vaga, fica programado");

// ---- Passageiros e rota do dia
const passageiros = (await req("GET", `/viagens/${await viagemDe(2)}/passageiros`, adm)).data;
ok(passageiros.length === 2 && passageiros.every((p) => p.status === "PROGRAMADO") && passageiros.some((p) => p.pontoEmbarque?.nome === "TST Praça Central"), "passageiros mostram programados e ponto", passageiros);
const rotaDia = (await req("GET", `/viagens/${await viagemDe(2)}/rota`, adm)).data;
ok(rotaDia.sentido === "IDA" && rotaDia.universidades[0].alunosConfirmados === 2 && rotaDia.pontosEmbarque.find((p) => p.nome === "TST Praça Central").alunos === 1 && rotaDia.pontosEmbarque.find((p) => p.nome === "TST Bairro Novo").ativoNoDia === false, "rota do dia conta alunos por instituição e ponto", rotaDia);

// ---- Embarque de quem está programado (não confirmou antes)
const mot = await login("tst.motoal@buson.com");
const idaD2 = await viagemDe(2);
const ini = await req("POST", `/viagens/${idaD2}/iniciar`, mot);
ok(ini.status === 200, "motorista inicia a viagem gerada", ini.data);
const qr = (await req("POST", `/viagens/${idaD2}/embarque/sessao`, mot)).data;
ok(typeof qr.conteudoQr === "string", "QR gerado", qr);
const scan = await req("POST", `/viagens/${idaD2}/embarque/scan`, ana.token, { token: String(qr.conteudoQr).split(".").slice(2).join(".") });
ok(scan.status === 201 || scan.status === 200, "aluno programado embarca pelo QR", scan.data);
ok(sql(`SELECT status FROM checkins WHERE viagemId='${idaD2}' AND alunoId='${ana.id}'`) === "CONFIRMADO", "embarque confirma o programado");

// ---- Capacidade: redução bloqueada, aumento propaga
ok((await req("PATCH", `/programacoes/${prog.id}`, adm, { onibusId: bus2.id })).data.code === "CAPACIDADE_INSUFICIENTE", "trocar por ônibus menor que os alocados é bloqueado");
ok((await req("PATCH", `/onibus/${bus.id}`, adm, { capacidade: 2 })).data.code === "CAPACIDADE_INSUFICIENTE", "reduzir a capacidade do ônibus abaixo dos alocados é bloqueado");
ok((await req("PATCH", `/onibus/${bus.id}`, adm, { capacidade: 4 })).status === 200, "aumentar a capacidade é aceito");
ok(sql(`SELECT vagas FROM viagens WHERE id='${idaD1}'`) === "4", "viagens futuras recebem a nova capacidade");

// ---- Mudanças na programação
ok((await req("PATCH", `/programacoes/${prog.id}`, adm, { horarioIda: "23:30" })).status === 200, "admin muda o horário da ida");
ok(sql(`SELECT horario FROM viagens WHERE id='${idaD1}'`) === "23:30", "viagens futuras recebem o novo horário");
const semD4 = todosDias.filter((d) => d !== d4);
ok((await req("PATCH", `/programacoes/${prog.id}`, adm, { diasSemana: semD4 })).status === 200, "admin remove um dia da programação");
ok(await viagemDe(4) === "" && await viagemDe(4, "VOLTA") === "", "as viagens do dia removido são canceladas");
ok(Number(sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE alunoId='${beto.id}' AND ativo=1`)) === 0, "alunos do dia removido perdem o dia");
ok(sql(`SELECT COUNT(*) FROM notificacoes n JOIN alunos a ON a.usuarioId=n.usuarioId WHERE a.id='${beto.id}' AND n.mensagem LIKE '%atende mais%'`) === "1", "e são avisados para escolher outro dia");

// ---- Viagem cancelada pelo admin (feriado) não volta na geração
const voltaD3 = await viagemDe(3, "VOLTA");
ok((await req("DELETE", `/viagens/${voltaD3}`, adm)).status === 200, "admin cancela uma viagem gerada");
await req("POST", "/programacoes/gerar", adm);
ok(await viagemDe(3, "VOLTA") === "", "a geração não recria a viagem cancelada");

// ---- Pontos: remoção da rota e exclusão em uso
ok((await req("DELETE", `/pontos-embarque/${p2.id}`, adm)).data.code === "EM_USO", "ponto usado por rota não é excluído");
ok((await req("PATCH", `/rotas/${rota.id}`, adm, { pontosEmbarqueIds: [p2.id] })).status === 200, "admin tira um ponto da rota");
ok(sql(`SELECT IFNULL(pontoEmbarqueId,'nulo') FROM alocacoes_aluno WHERE alunoId='${ana.id}' AND diaSemana=${d1}`) === "nulo", "alocações no ponto removido ficam sem ponto");
ok(sql(`SELECT COUNT(*) FROM notificacoes n JOIN alunos a ON a.usuarioId=n.usuarioId WHERE a.id='${ana.id}' AND n.mensagem LIKE '%ponto de embarque saiu%'`) === "1", "aluno é avisado para escolher outro ponto");

// ---- Aluno troca de instituição → dias da rota antiga saem
await req("PATCH", "/alunos/me", eva.token, { universidadeId: uniB.id });
ok(Number(sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE alunoId='${eva.id}' AND ativo=1`)) === 0, "troca de instituição remove dias de rota que não a atende");

// ---- Exclusão da programação
const restantes = Number(sql(`SELECT COUNT(*) FROM viagens WHERE programacaoId='${prog.id}' AND status='AGUARDANDO'`));
ok((await req("DELETE", `/programacoes/${prog.id}`, adm)).status === 204, "admin exclui a programação");
ok(Number(sql(`SELECT COUNT(*) FROM viagens WHERE rotaId='${rota.id}' AND status='AGUARDANDO'`)) === 0 && restantes > 0, "viagens futuras são canceladas");
ok(sql(`SELECT status FROM viagens WHERE id='${idaD2}'`) === "EM_ANDAMENTO", "viagem em andamento é preservada");
ok(Number(sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE rotaId='${rota.id}' AND ativo=1`)) === 0, "dias dos alunos na rota são liberados");

const falhas = resultado();
limparTST();
process.exit(falhas ? 1 : 0);
