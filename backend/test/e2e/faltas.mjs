// Fase 4 (evolução) — faltas: registro ao encerrar, volta liberada, aviso prévio, justificativa, decisão e alerta
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { BASE, hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

const UPLOADS = process.env.UPLOADS_DIR;
if (!UPLOADS) throw new Error("Defina UPLOADS_DIR igual ao da API de teste");
limparTST();
rmSync(path.join(UPLOADS, "faltas"), { recursive: true, force: true });

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100, 0)]);
const adm = await login("admin@buson.com");
const diaSemana = (offset) => new Date(`${hojeISO(offset)}T12:00:00`).getDay();
const d1 = diaSemana(1);
const notif = (email, trecho) =>
  Number(sql(`SELECT COUNT(*) FROM notificacoes n JOIN usuarios u ON u.id=n.usuarioId WHERE u.email='${email}' AND n.mensagem LIKE '%${trecho}%'`));

// ---- Preparação: rota programada todos os dias, ônibus de 4 lugares
const uni = (await req("POST", "/universidades", adm, { nome: "TST Inst Falta" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-FAL1", capacidade: 4 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista Falta", email: "tst.motofal@buson.com", senha: "123456", onibusId: bus.id });
const motId = (await req("GET", "/motoristas", adm)).data.find((m) => m.usuario.email === "tst.motofal@buson.com").id;
const mot = await login("tst.motofal@buson.com");
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota Falta", universidadeIds: [uni.id] })).data;
const prog = (
  await req("POST", "/programacoes", adm, {
    rotaId: rota.id,
    onibusId: bus.id,
    motoristaId: motId,
    horarioIda: "23:40",
    horarioVolta: "23:55",
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
  })
).data;
const diaLocal = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const viagemDe = async (sentido) =>
  (await req("GET", `/viagens?desde=${hojeISO()}`, adm)).data.find((v) => v.programacaoId === prog.id && v.sentido === sentido && diaLocal(v.data) === hojeISO(1)).id;
const ida = await viagemDe("IDA");
const volta = await viagemDe("VOLTA");

async function aluno(nome, email, dias) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: "123456", universidadeId: uni.id });
  const token = await login(email);
  const id = (await req("GET", "/alunos/me", token)).data.id;
  await req("PATCH", `/alunos/${id}/status`, adm, { status: "ATIVO" });
  if (dias) await req("PUT", "/alunos/me/dias", token, { dias: [{ diaSemana: d1, rotaId: rota.id }] });
  return { token, id, email };
}
const ana = await aluno("TST Ana Falta", "tst.anafal@buson.com", true);
const beto = await aluno("TST Beto Falta", "tst.betofal@buson.com", true);
const caio = await aluno("TST Caio Falta", "tst.caiofal@buson.com", true);
const dani = await aluno("TST Dani Falta", "tst.danifal@buson.com", true);
const eva = await aluno("TST Eva Falta", "tst.evafal@buson.com");
const fabi = await aluno("TST Fabi Falta", "tst.fabifal@buson.com");
const gil = await aluno("TST Gil Falta", "tst.gilfal@buson.com");
const statusEm = (viagem, a) => sql(`SELECT status FROM checkins WHERE viagemId='${viagem}' AND alunoId='${a.id}'`);

ok(statusEm(ida, ana) === "PROGRAMADO" && statusEm(volta, dani) === "PROGRAMADO", "4 alunos com dia fixo nas duas viagens do dia");
ok((await req("POST", `/viagens/${volta}/checkin`, eva.token)).data.status === "ESPERA", "volta lotada: avulso entra na espera");
ok((await req("POST", `/viagens/${ida}/checkin`, fabi.token)).data.status === "ESPERA", "ida lotada: avulso entra na espera");

// ---- Aviso prévio (não é falta)
ok((await req("POST", `/viagens/${ida}/checkin/cancelar`, dani.token, { motivo: "FALTOU_NA_IDA" })).data.code === "VALIDACAO", "motivo reservado ao sistema é recusado");
const aviso = await req("POST", `/viagens/${ida}/checkin/cancelar`, dani.token, { motivo: "DOENCA", diaTodo: true });
ok(aviso.status === 200 && aviso.data.liberouIrma === true, "aluno avisa que não vai (ida e volta)", aviso.data);
ok(sql(`SELECT CONCAT(status,'/',motivoAusencia) FROM checkins WHERE viagemId='${volta}' AND alunoId='${dani.id}'`) === "CANCELADO/DOENCA", "a volta também é liberada com o motivo");
ok(statusEm(ida, fabi) === "CONFIRMADO" && statusEm(volta, eva) === "CONFIRMADO", "as vagas liberadas vão para a lista de espera");
const hDani = (await req("GET", "/faltas/me", dani.token)).data;
ok(hDani.faltas.length === 0 && hDani.ausenciasAvisadas.length === 2 && hDani.ausenciasAvisadas[0].motivoAusencia === "DOENCA", "aviso prévio fica como ausência avisada, não como falta", hDani);
ok((await req("POST", `/viagens/${volta}/checkin`, gil.token)).data.status === "ESPERA", "gil entra na espera da volta");

// ---- Encerrar a ida registra as faltas
await req("POST", `/viagens/${ida}/iniciar`, mot);
await req("POST", `/viagens/${ida}/embarque/manual`, mot, { alunoId: ana.id });
const [e1, e2] = await Promise.all([req("POST", `/viagens/${ida}/encerrar`, mot), req("POST", `/viagens/${ida}/encerrar`, mot)]);
const venceu = [e1, e2].find((r) => r.status === 200);
ok(venceu && [e1, e2].some((r) => r.data.code === "ENCERRAMENTO_INVALIDO"), "dois 'Encerrar' ao mesmo tempo: só um vale", [e1.status, e2.status]);
ok(venceu.data.faltasRegistradas === 3, "encerrar registra 3 faltas (quem tinha vaga e não embarcou)", venceu.data.faltasRegistradas);
ok(Number(sql(`SELECT COUNT(*) FROM faltas WHERE viagemId='${ida}'`)) === 3, "faltas gravadas uma vez só");
ok(sql(`SELECT COUNT(*) FROM faltas WHERE viagemId='${ida}' AND alunoId IN ('${ana.id}','${dani.id}')`) === "0", "quem embarcou ou avisou antes não leva falta");
const dias = Number(sql(`SELECT DATEDIFF(prazoJustificativa, NOW()) FROM faltas WHERE viagemId='${ida}' AND alunoId='${beto.id}'`));
ok(dias >= 6 && dias <= 7, "prazo de 7 dias para justificar", dias);
ok(sql(`SELECT CONCAT(status,'/',motivoAusencia) FROM checkins WHERE viagemId='${volta}' AND alunoId='${beto.id}'`) === "CANCELADO/FALTOU_NA_IDA", "falta na ida libera a vaga da volta");
ok(statusEm(volta, gil) === "CONFIRMADO", "a vaga liberada na volta vai para a espera");
ok(notif(beto.email, "Falta registrada") === 1 && notif(beto.email, "volta de hoje foi liberada") === 1, "aluno é avisado da falta, do prazo e da volta liberada");
ok(notif(ana.email, "Falta registrada") === 0, "quem embarcou não recebe aviso de falta");
ok((await req("GET", "/alunos/me", beto.token)).data.pendencias.includes("FALTA_A_JUSTIFICAR"), "pendência 'falta a justificar' aparece para o aluno");

// ---- Justificativa do aluno
const fBeto = sql(`SELECT id FROM faltas WHERE viagemId='${ida}' AND alunoId='${beto.id}'`);
const fCaio = sql(`SELECT id FROM faltas WHERE viagemId='${ida}' AND alunoId='${caio.id}'`);
const fFabi = sql(`SELECT id FROM faltas WHERE viagemId='${ida}' AND alunoId='${fabi.id}'`);
function formulario(texto, anexo, nome = "atestado.pdf") {
  const f = new FormData();
  if (texto !== undefined) f.append("justificativa", texto);
  if (anexo) f.append("anexo", new Blob([anexo]), nome);
  return f;
}
ok((await req("POST", `/faltas/${fBeto}/justificativa`, beto.token, formulario("ok"))).data.code === "VALIDACAO", "justificativa curta demais é recusada");
ok((await req("POST", `/faltas/${fBeto}/justificativa`, caio.token, formulario("Estava doente e fui ao médico"))).data.code === "FALTA_NAO_ENCONTRADA", "aluno não justifica falta de outro");
ok((await req("POST", `/faltas/${fBeto}/justificativa`, beto.token, formulario("Estava doente e fui ao médico", EXE, "a.pdf"))).data.code === "TIPO_ARQUIVO_INVALIDO", "anexo que não é PDF/imagem é recusado");
const dirBeto = path.join(UPLOADS, "faltas", beto.id);
ok(!existsSync(dirBeto) || readdirSync(dirBeto).length === 0, "anexo recusado não fica no disco");
const just = await req("POST", `/faltas/${fBeto}/justificativa`, beto.token, formulario("Estava doente e fui ao médico", PDF));
ok(just.status === 200 && just.data.justificativa && just.data.anexoNome === "atestado.pdf" && just.data.status === "REGISTRADA", "aluno justifica com atestado (aguarda decisão)", just.data);
ok(!("anexoArquivo" in just.data), "resposta não expõe o caminho do anexo");
ok(readdirSync(dirBeto).length === 1, "anexo gravado no armazenamento (UPLOADS_DIR/faltas/<aluno>)");
ok((await req("POST", `/faltas/${fBeto}/justificativa`, beto.token, formulario("De novo, estava doente"))).data.code === "JUSTIFICATIVA_JA_ENVIADA", "não envia duas justificativas");
ok(notif("admin@buson.com", "TST Beto Falta justificou") === 1, "administração é avisada da justificativa");
sql(`UPDATE faltas SET prazoJustificativa = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id='${fCaio}'`);
ok((await req("POST", `/faltas/${fCaio}/justificativa`, caio.token, formulario("Perdi o horário do ônibus"))).data.code === "PRAZO_JUSTIFICATIVA_ENCERRADO", "depois do prazo o aluno não justifica mais");
ok(!(await req("GET", "/alunos/me", caio.token)).data.pendencias.includes("FALTA_A_JUSTIFICAR"), "falta com prazo vencido sai das pendências do aluno");

// ---- Anexo por link temporário
ok((await req("POST", `/faltas/${fBeto}/anexo/link`, caio.token)).data.code === "FALTA_NAO_ENCONTRADA", "outro aluno não abre o anexo");
ok((await req("POST", `/faltas/${fCaio}/anexo/link`, adm)).data.code === "ANEXO_NAO_ENCONTRADO", "falta sem anexo não gera link");
const link = await req("POST", `/faltas/${fBeto}/anexo/link`, adm);
const baixado = await fetch(BASE + link.data.caminho);
ok(baixado.status === 200 && Buffer.from(await baixado.arrayBuffer()).equals(PDF) && baixado.headers.get("content-type") === "application/pdf", "admin abre o atestado pelo link");
ok((await fetch(BASE + link.data.caminho.replace(fBeto, fCaio))).status === 403, "assinatura de uma falta não abre outra");
ok((await req("POST", `/faltas/${fBeto}/anexo/link`, beto.token)).status === 200, "o próprio aluno abre o anexo");

// ---- Fila e decisão da administração
const fila = (await req("GET", `/faltas?situacao=AGUARDANDO_DECISAO&busca=TST`, adm)).data;
ok(fila.itens.length === 1 && fila.itens[0].id === fBeto && fila.contagens.SEM_JUSTIFICATIVA === 2, "fila 'aguardando decisão' com contagens", fila.contagens);
ok((await req("GET", "/faltas", beto.token)).data.code === "SEM_PERMISSAO", "aluno não vê a fila");
ok((await req("POST", `/faltas/${fBeto}/indeferir`, adm, {})).data.code === "VALIDACAO", "indeferir exige motivo");
ok((await req("POST", `/faltas/${fBeto}/justificar`, beto.token)).data.code === "SEM_PERMISSAO", "aluno não decide");
const ind = await req("POST", `/faltas/${fBeto}/indeferir`, adm, { motivo: "Atestado sem data e sem carimbo" });
ok(ind.status === 200 && ind.data.status === "INDEFERIDA" && ind.data.decididoPor?.nome, "admin indefere com motivo", ind.data);
ok(notif(beto.email, "sem data e sem carimbo") === 1, "aluno recebe o motivo do indeferimento");
ok((await req("POST", `/faltas/${fBeto}/justificar`, adm)).data.code === "FALTA_JA_DECIDIDA", "falta decidida não muda de novo");
const direto = await req("POST", `/faltas/${fCaio}/justificar`, adm, { observacao: "Motorista confirmou que ele embarcou" });
ok(direto.status === 200 && direto.data.status === "JUSTIFICADA", "admin justifica direto (mesmo sem justificativa do aluno / fora do prazo)");
ok(notif(caio.email, "foi justificada") === 1, "aluno é avisado da falta justificada");

// Justificar e indeferir ao mesmo tempo
const [j1, j2] = await Promise.all([
  req("POST", `/faltas/${fFabi}/justificar`, adm),
  req("POST", `/faltas/${fFabi}/indeferir`, adm, { motivo: "Sem justificativa enviada" }),
]);
ok([j1, j2].filter((r) => r.status === 200).length === 1 && [j1, j2].some((r) => r.data.code === "FALTA_JA_DECIDIDA"), "decisões simultâneas: só uma vale");

// ---- Auditoria e perfil
const perfil = (await req("GET", `/alunos/${beto.id}`, adm)).data;
const acoes = perfil.historico.map((h) => h.acao);
ok(acoes.includes("FALTA_JUSTIFICATIVA_ENVIADA") && acoes.includes("FALTA_INDEFERIDA"), "justificativa e decisão ficam na auditoria", acoes);
const indAud = perfil.historico.find((h) => h.acao === "FALTA_INDEFERIDA");
ok(indAud.usuario?.papel === "ADMIN" && indAud.valorAnterior.falta === "REGISTRADA" && indAud.valorNovo.falta === "INDEFERIDA" && indAud.detalhes.motivo, "auditoria com autor, antes/depois e motivo", indAud);
ok(perfil.faltas.length === 1 && perfil.faltas[0].status === "INDEFERIDA", "perfil do aluno (admin) mostra as faltas");
ok((await req("GET", `/alunos/${dani.id}`, adm)).data.ausenciasAvisadas.length === 2, "perfil mostra as ausências avisadas");

// ---- Relatório do dashboard lê a tabela de faltas
const rel = (await req("GET", `/dashboard/relatorio?inicio=${hojeISO(1)}&fim=${hojeISO(1)}`, adm)).data;
const minhas = rel.faltas.filter((f) => f.rota === "TST Rota Falta");
ok(minhas.length === 3 && minhas.some((f) => f.situacao === "INDEFERIDA") && minhas.some((f) => f.situacao === "JUSTIFICADA"), "relatório lista as faltas com a situação", minhas);
ok(rel.faltasPorUniversidade["TST Inst Falta"] === 3 && rel.totais.faltas >= 3, "faltas por instituição no relatório");

// ---- Alerta: 3 faltas sem justificativa em 30 dias
const hugo = await aluno("TST Hugo Falta", "tst.hugofal@buson.com");
for (const [i, horario] of ["20:00", "20:30", "21:00", "21:30"].entries()) {
  const v = (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: motId, data: hojeISO(1), horario })).data;
  await req("POST", `/viagens/${v.id}/checkin`, hugo.token);
  await req("POST", `/viagens/${v.id}/iniciar`, mot);
  await req("POST", `/viagens/${v.id}/encerrar`, mot);
  if (i === 1) ok(notif("admin@buson.com", "TST Hugo Falta tem 3") === 0, "2 faltas ainda não geram alerta");
}
ok(notif("admin@buson.com", "TST Hugo Falta tem 3 faltas sem justificativa") === 1, "3ª falta sem justificativa em 30 dias alerta a administração (uma vez só)");

const falhas = resultado();
limparTST();
rmSync(path.join(UPLOADS, "faltas"), { recursive: true, force: true });
process.exit(falhas ? 1 : 0);
