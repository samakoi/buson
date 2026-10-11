// Fase 12 — Viagem com ida e volta: rota criada e editada dentro da viagem (programação), paradas por
// trecho, edição concorrente e exclusão da rota mesmo com alunos vinculados, preservando o histórico.
import { hojeISO, limparTST, login, ok, req, resultado, SENHA_TST, sql } from "./lib.mjs";

limparTST();
const adm = await login("admin@buson.com");

// ---- Cadastros independentes (instituições, pontos, ônibus, motorista)
const uniA = (await req("POST", "/universidades", adm, { nome: "TST Inst Rota A" })).data;
const uniB = (await req("POST", "/universidades", adm, { nome: "TST Inst Rota B" })).data;
const p1 = (await req("POST", "/pontos-embarque", adm, { nome: "TST Ponto Rota 1" })).data;
const p2 = (await req("POST", "/pontos-embarque", adm, { nome: "TST Ponto Rota 2" })).data;
const p3 = (await req("POST", "/pontos-embarque", adm, { nome: "TST Ponto Rota 3" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-ROT1", capacidade: 4 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista Rota", email: "tst.motorota@buson.com", senha: SENHA_TST, onibusId: bus.id });
const motId = (await req("GET", "/motoristas", adm)).data.find((m) => m.usuario.email === "tst.motorota@buson.com").id;
const mot = await login("tst.motorota@buson.com");

const ida = { origem: "TST Bairro", destino: "TST Instituições", universidadeIds: [uniA.id, uniB.id], pontosEmbarqueIds: [p1.id, p2.id] };
const volta = { origem: "TST Instituições", destino: "TST Bairro", universidadeIds: [uniB.id, uniA.id], pontosEmbarqueIds: [p2.id, p1.id] };
const todosDias = [0, 1, 2, 3, 4, 5, 6];

// ---- 1. Criar a viagem com ida e volta, sem cadastrar a rota antes
const criada = await req("POST", "/programacoes", adm, {
  rota: { nome: "TST Viagem Bairro", ida, volta },
  onibusId: bus.id,
  motoristaId: motId,
  horarioIda: "23:20",
  horarioVolta: "23:40",
  diasSemana: todosDias,
});
ok(criada.status === 201, "cria a viagem com a rota junto (ida e volta)", criada.data);
const prog = criada.data;
const rotaId = prog.rotaId;
ok(
  prog.rota.trechos.ida.origem === "TST Bairro" && prog.rota.trechos.volta.origem === "TST Instituições",
  "a viagem já vem com os dois trechos",
  prog.rota.trechos
);
ok(
  prog.rota.trechos.volta.instituicoes.map((p) => p.universidadeId).join() === [uniB.id, uniA.id].join(),
  "a volta tem paradas próprias, na ordem informada"
);
ok(sql(`SELECT COUNT(*) FROM trechos_rota WHERE rotaId='${rotaId}'`) === "2", "dois trechos gravados");
ok(
  (
    await req("POST", "/programacoes", adm, {
      rota: { ida, volta },
      rotaId,
      onibusId: bus.id,
      motoristaId: motId,
      horarioIda: "07:00",
      diasSemana: [1],
    })
  ).data.code === "VALIDACAO",
  "rotaId e rota juntos são recusados"
);
const viagensGeradas = Number(sql(`SELECT COUNT(*) FROM viagens WHERE rotaId='${rotaId}' AND status='AGUARDANDO'`));
ok(viagensGeradas >= 12, "a viagem gera ida e volta dos próximos dias", viagensGeradas);

// ---- 2 e 3. Editar ida e volta (origem, destino e horário) dentro da viagem
const versao1 = prog.atualizadoEm;
const ed1 = await req("PATCH", `/programacoes/${prog.id}`, adm, {
  versao: versao1,
  horarioIda: "23:10",
  rota: { ida: { ...ida, origem: "TST Terminal", destino: "TST Campus" } },
});
ok(
  ed1.status === 200 && ed1.data.rota.trechos.ida.origem === "TST Terminal" && ed1.data.horarioIda === "23:10",
  "edita origem, destino e horário da ida",
  ed1.data
);
ok(ed1.data.rota.trechos.volta.origem === "TST Instituições", "editar a ida não mexe na volta");
ok(
  sql(`SELECT COUNT(*) FROM viagens WHERE rotaId='${rotaId}' AND sentido='IDA' AND status='AGUARDANDO' AND horario<>'23:10'`) === "0",
  "viagens futuras da ida recebem o novo horário"
);
const ed2 = await req("PATCH", `/programacoes/${prog.id}`, adm, {
  versao: ed1.data.atualizadoEm,
  horarioVolta: "23:50",
  rota: { volta: { ...volta, origem: "TST Campus", destino: "TST Rodoviária" } },
});
ok(
  ed2.status === 200 && ed2.data.rota.trechos.volta.destino === "TST Rodoviária" && ed2.data.horarioVolta === "23:50",
  "edita origem, destino e horário da volta",
  ed2.data
);
ok(ed2.data.rota.trechos.ida.origem === "TST Terminal", "editar a volta não mexe na ida");

// ---- Edição concorrente: a versão antiga é recusada e nada muda
const conflito = await req("PATCH", `/programacoes/${prog.id}`, adm, { versao: versao1, horarioIda: "06:00" });
ok(conflito.status === 409 && conflito.data.code === "EDICAO_CONFLITANTE", "edição com versão antiga é recusada", conflito.data);
ok((await req("GET", `/programacoes/${prog.id}`, adm)).data.horarioIda === "23:10", "a alteração mais recente foi mantida");

// ---- 4. Adicionar, remover e reordenar pontos
const ed3 = await req("PATCH", `/programacoes/${prog.id}`, adm, {
  versao: ed2.data.atualizadoEm,
  rota: { ida: { ...ida, origem: "TST Terminal", destino: "TST Campus", pontosEmbarqueIds: [p3.id, p1.id] } },
});
ok(
  ed3.status === 200 && ed3.data.rota.trechos.ida.pontosEmbarque.map((p) => p.pontoEmbarqueId).join() === [p3.id, p1.id].join(),
  "adiciona p3, remove p2 e reordena os pontos da ida"
);
ok(sql(`SELECT ativo FROM pontos_embarque WHERE id='${p2.id}'`) === "1", "tirar o ponto da rota não apaga o cadastro do ponto");
ok(
  (
    await req("PATCH", `/programacoes/${prog.id}`, adm, {
      rota: { ida: { ...ida, pontosEmbarqueIds: ["00000000-0000-4000-8000-000000000000"] } },
    })
  ).data.code === "PONTO_EMBARQUE_NAO_ENCONTRADO",
  "ponto inexistente é recusado"
);
ok(
  (await req("GET", `/programacoes/${prog.id}`, adm)).data.rota.trechos.ida.pontosEmbarque.length === 2,
  "a falha não deixa a rota pela metade (transação)"
);
ok(
  (await req("PATCH", `/programacoes/${prog.id}`, adm, { rota: { ida: { ...ida, origem: "X" } } })).data.code === "VALIDACAO",
  "origem curta demais é recusada"
);
ok((await req("PATCH", `/programacoes/${prog.id}`, adm, { horarioIda: "25:00" })).data.code === "VALIDACAO", "horário inválido é recusado");

// ---- 5. Salvar várias vezes não duplica trechos nem paradas
for (let i = 0; i < 3; i++) {
  await req("PATCH", `/programacoes/${prog.id}`, adm, { rota: { ida: { ...ida, origem: "TST Terminal", destino: "TST Campus" }, volta } });
}
ok(sql(`SELECT COUNT(*) FROM trechos_rota WHERE rotaId='${rotaId}'`) === "2", "continua com 2 trechos depois de salvar 3 vezes");
ok(sql(`SELECT COUNT(*) FROM pontos_rota WHERE rotaId='${rotaId}'`) === "4", "instituições sem duplicar (2 na ida + 2 na volta)");
ok(sql(`SELECT COUNT(*) FROM rota_pontos_embarque WHERE rotaId='${rotaId}'`) === "4", "pontos sem duplicar (2 na ida + 2 na volta)");

// ---- Rota do dia e parada de cada trecho (a volta usa as paradas dela)
const viagemVolta = sql(
  `SELECT id FROM viagens WHERE rotaId='${rotaId}' AND sentido='VOLTA' AND status='AGUARDANDO' ORDER BY data LIMIT 1`
);
const rotaVolta = (await req("GET", `/viagens/${viagemVolta}/rota`, mot)).data;
ok(
  rotaVolta.sentido === "VOLTA" && rotaVolta.universidades.map((u) => u.universidade).join() === "TST Inst Rota B,TST Inst Rota A",
  "a rota do dia da volta segue as instituições da volta",
  rotaVolta
);

// ---- Alunos com dias fixos e uma viagem já feita (histórico)
async function novoAluno(nome, email) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: SENHA_TST, universidadeId: uniA.id });
  const token = await login(email);
  const id = (await req("GET", "/alunos/me", token)).data.id;
  await req("PATCH", `/alunos/${id}/status`, adm, { status: "ATIVO" });
  return { token, id };
}
const ana = await novoAluno("TST Ana Rota", "tst.anarota@buson.com");
const beto = await novoAluno("TST Beto Rota", "tst.betorota@buson.com");
const opcoes = (await req("GET", "/alunos/me/dias", ana.token)).data.opcoes;
const opcao = opcoes.find((o) => o.rota.id === rotaId);
ok(
  opcao &&
    opcao.trechos.ida.origem === "TST Terminal" &&
    opcao.trechos.volta.destino === "TST Bairro" &&
    opcao.trechos.ida.horario === "23:10",
  "o aluno vê a viagem como uma opção só, com ida e volta descritas",
  opcao
);
const dias = { dias: todosDias.map((diaSemana) => ({ diaSemana, rotaId, pontoEmbarqueId: p1.id })) };
ok((await req("PUT", "/alunos/me/dias", ana.token, dias)).status === 200, "aluno escolhe os dias na viagem");
ok((await req("PUT", "/alunos/me/dias", beto.token, dias)).status === 200, "segundo aluno escolhe os dias");
ok(
  (await req("PUT", "/alunos/me/dias", ana.token, { dias: [{ diaSemana: 1, rotaId, pontoEmbarqueId: p3.id }] })).data.code ===
    "PONTO_FORA_DA_ROTA",
  "ponto que saiu da ida (p3) não pode ser escolhido"
);

// Viagem já realizada: embarque da Ana e falta do Beto
const feita = (await req("POST", "/viagens", adm, { rotaId, onibusId: bus.id, motoristaId: motId, data: hojeISO(), horario: "23:00" }))
  .data;
await req("POST", `/viagens/${feita.id}/checkin`, ana.token);
await req("POST", `/viagens/${feita.id}/checkin`, beto.token);
await req("POST", `/viagens/${feita.id}/iniciar`, mot);

// ---- 11. Viagem em andamento bloqueia a exclusão (e nada muda)
const emAndamento = await req("DELETE", `/rotas/${rotaId}?confirmarVinculos=true`, adm);
ok(
  emAndamento.status === 409 && emAndamento.data.code === "ROTA_COM_VIAGEM_EM_ANDAMENTO",
  "não exclui com ônibus em viagem",
  emAndamento.data
);
ok(sql(`SELECT excluidaEm IS NULL FROM rotas WHERE id='${rotaId}'`) === "1", "a rota continua ativa");
await req("POST", `/viagens/${feita.id}/embarque/manual`, mot, { alunoId: ana.id });
await req("POST", `/viagens/${feita.id}/encerrar`, mot);
ok(sql(`SELECT COUNT(*) FROM faltas WHERE viagemId='${feita.id}'`) === "1", "viagem feita com 1 embarque e 1 falta");

// ---- 10. Sem permissão
ok((await req("DELETE", `/rotas/${rotaId}?confirmarVinculos=true`, ana.token)).status === 403, "aluno não exclui rota");
ok((await req("DELETE", `/rotas/${rotaId}?confirmarVinculos=true`, mot)).status === 403, "motorista não exclui rota");
ok((await req("DELETE", `/rotas/${rotaId}?confirmarVinculos=true`, null)).status === 401, "sem login não exclui rota");
ok((await req("GET", `/rotas/${rotaId}/impacto-exclusao`, ana.token)).status === 403, "aluno não vê o impacto");

// ---- 7. Exclusão com alunos vinculados
const impacto = (await req("GET", `/rotas/${rotaId}/impacto-exclusao`, adm)).data;
ok(
  impacto.alunosComDiasFixos === 2 &&
    impacto.viagensFuturas >= 12 &&
    impacto.reservasFuturas > 0 &&
    impacto.viagensNoHistorico >= 1 &&
    impacto.temVinculos,
  "impacto: alunos, viagens e reservas futuras e o histórico",
  impacto
);
const semConfirmar = await req("DELETE", `/rotas/${rotaId}`, adm);
ok(
  semConfirmar.status === 409 && semConfirmar.data.code === "ROTA_COM_VINCULOS" && semConfirmar.data.detalhes.alunosComDiasFixos === 2,
  "com vínculos, exige confirmação explícita (o backend não depende da tela)",
  semConfirmar.data
);
ok(sql(`SELECT excluidaEm IS NULL FROM rotas WHERE id='${rotaId}'`) === "1", "sem confirmação nada é excluído");
const excluida = await req("DELETE", `/rotas/${rotaId}?confirmarVinculos=true`, adm);
ok(
  excluida.status === 200 && excluida.data.viagensCanceladas === impacto.viagensFuturas,
  "admin exclui a rota com alunos vinculados",
  excluida.data
);

ok(sql(`SELECT excluidaEm IS NOT NULL FROM rotas WHERE id='${rotaId}'`) === "1", "exclusão lógica: a rota fica marcada como excluída");
ok(
  sql(`SELECT COUNT(*) FROM viagens WHERE rotaId='${rotaId}' AND status='AGUARDANDO' AND data >= CURDATE()`) === "0",
  "viagens futuras canceladas (e as reservas delas)"
);
ok(sql(`SELECT COUNT(*) FROM programacoes WHERE rotaId='${rotaId}'`) === "0", "a programação da viagem foi encerrada");
ok(
  sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE rotaId='${rotaId}' AND ativo=1`) === "0" &&
    sql(`SELECT COUNT(*) FROM alocacoes_aluno WHERE rotaId='${rotaId}'`) === "14",
  "dias fixos dos alunos desativados, não apagados"
);
ok(
  sql(
    `SELECT COUNT(*) FROM notificacoes n JOIN alunos a ON a.usuarioId=n.usuarioId WHERE a.id IN ('${ana.id}','${beto.id}') AND (n.mensagem LIKE '%foi cancelada%' OR n.mensagem LIKE '%não atende mais%')`
  ) > "0",
  "alunos avisados"
);
ok(
  sql(`SELECT COUNT(*) FROM usuarios WHERE email IN ('tst.anarota@buson.com','tst.betorota@buson.com')`) === "2",
  "alunos não são excluídos"
);
ok(sql(`SELECT COUNT(*) FROM universidades WHERE id IN ('${uniA.id}','${uniB.id}')`) === "2", "instituições continuam cadastradas");
ok(sql(`SELECT COUNT(*) FROM pontos_embarque WHERE id IN ('${p1.id}','${p2.id}','${p3.id}')`) === "3", "pontos continuam cadastrados");
ok(
  sql(`SELECT COUNT(*) FROM auditorias WHERE entidadeId='${rotaId}' AND acao='ROTA_REMOVIDA' AND usuarioId IS NOT NULL`) === "1",
  "exclusão auditada com o autor"
);

// ---- 8. Histórico preservado
ok(sql(`SELECT COUNT(*) FROM viagens WHERE id='${feita.id}' AND status='ENCERRADA'`) === "1", "a viagem feita continua no histórico");
ok(sql(`SELECT COUNT(*) FROM embarques WHERE viagemId='${feita.id}'`) === "1", "o embarque continua registrado");
ok(sql(`SELECT COUNT(*) FROM faltas WHERE viagemId='${feita.id}'`) === "1", "a falta continua registrada");
const hist = (await req("GET", `/viagens/${feita.id}/detalhe`, adm)).data;
ok(
  hist?.viagem?.rota?.nome === "TST Viagem Bairro" && hist.passageiros.length === 2,
  "o detalhe da viagem feita continua abrindo",
  hist?.resumo
);

// ---- 9. Rota excluída não aparece nem pode ser escolhida
ok(!(await req("GET", "/rotas", adm)).data.some((r) => r.id === rotaId), "some da lista de rotas");
ok(!(await req("GET", "/programacoes", adm)).data.some((p) => p.rotaId === rotaId), "some da programação");
ok(!(await req("GET", "/alunos/me/dias", ana.token)).data.opcoes.some((o) => o.rota.id === rotaId), "some das opções do aluno");
ok((await req("PUT", "/alunos/me/dias", ana.token, dias)).data.code === "ROTA_NAO_CADASTRADA", "aluno não escolhe a rota excluída");
ok(
  (await req("POST", "/viagens", adm, { rotaId, onibusId: bus.id, motoristaId: motId, data: hojeISO(1), horario: "08:00" })).data.code ===
    "ROTA_NAO_CADASTRADA",
  "não cria viagem avulsa na rota excluída"
);
ok(
  (await req("POST", "/programacoes", adm, { rotaId, onibusId: bus.id, motoristaId: motId, horarioIda: "07:00", diasSemana: [1] })).data
    .code === "ROTA_NAO_CADASTRADA",
  "não programa a rota excluída"
);
ok((await req("PATCH", `/rotas/${rotaId}`, adm, { nome: "TST Volta" })).status === 404, "não edita a rota excluída");
ok((await req("DELETE", `/rotas/${rotaId}?confirmarVinculos=true`, adm)).status === 404, "excluir de novo responde 404");

// ---- 6. Excluir rota sem vínculos (cadastrada sem programação, no formato antigo do app)
const legada = await req("POST", "/rotas", adm, { nome: "TST Rota Legada", universidadeIds: [uniA.id], pontosEmbarqueIds: [p1.id, p2.id] });
ok(legada.status === 201, "o formato antigo do app ainda cria rota", legada.data);
ok(
  legada.data.trechos.volta.pontosEmbarque.map((p) => p.pontoEmbarqueId).join() === [p2.id, p1.id].join() &&
    legada.data.trechos.volta.instituicoes.length === 1,
  "formato antigo vira ida e volta (pontos invertidos na volta)"
);
ok(!(await req("GET", `/rotas/${legada.data.id}/impacto-exclusao`, adm)).data.temVinculos, "rota nova não tem vínculos");
const simples = await req("DELETE", `/rotas/${legada.data.id}`, adm);
ok(simples.status === 200 && simples.data.viagensCanceladas === 0, "rota sem vínculos é excluída sem confirmação extra", simples.data);
ok(!(await req("GET", "/rotas", adm)).data.some((r) => r.id === legada.data.id), "e some da lista");

const falhas = resultado();
limparTST();
process.exit(falhas ? 1 : 0);
