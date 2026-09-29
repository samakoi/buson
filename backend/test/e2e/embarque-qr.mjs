// Fase 1 (evolução) — embarque pelo QR temporário do motorista: fluxo e testes de segurança
import { hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

limparTST();
const adm = await login("admin@buson.com");
const tokenDoQr = (conteudo) => conteudo.split(".").slice(2).join(".");

// ---- Preparação: 2 instituições, rota só com a A, ônibus, motorista, 2 viagens
const uniA = (await req("POST", "/universidades", adm, { nome: "TST Inst A" })).data;
const uniB = (await req("POST", "/universidades", adm, { nome: "TST Inst B" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-QR1", capacidade: 10 })).data;
const bus2 = (await req("POST", "/onibus", adm, { placa: "TST-QR2", capacidade: 10 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista QR", email: "tst.motoqr@buson.com", senha: "123456", onibusId: bus.id });
await req("POST", "/motoristas", adm, { nome: "TST Motorista Outro", email: "tst.motoout@buson.com", senha: "123456" });
const motoristas = (await req("GET", "/motoristas", adm)).data;
const motQrId = motoristas.find((m) => m.usuario.email === "tst.motoqr@buson.com").id;
const motOutId = motoristas.find((m) => m.usuario.email === "tst.motoout@buson.com").id;
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota QR", universidadeIds: [uniA.id] })).data;
const viagem = (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: motQrId, data: hojeISO(), horario: "23:58" })).data;
const outraViagem = (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus2.id, motoristaId: motOutId, data: hojeISO(), horario: "23:59" })).data;

async function aluno(nome, email, uni) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: "123456", universidadeId: uni });
  return login(email);
}
const ana = await aluno("TST Ana", "tst.ana@buson.com", uniA.id);
const beto = await aluno("TST Beto", "tst.beto@buson.com", uniA.id);
const caio = await aluno("TST Caio", "tst.caio@buson.com", uniB.id); // instituição fora da rota
const dani = await aluno("TST Dani", "tst.dani@buson.com", uniA.id); // sem check-in
for (const t of [ana, beto, caio]) await req("POST", `/viagens/${viagem.id}/checkin`, t);
await req("POST", `/viagens/${outraViagem.id}/checkin`, ana);

const mot = await login("tst.motoqr@buson.com");
const motOutro = await login("tst.motoout@buson.com");

// ---- Motorista gera o QR
ok((await req("POST", `/viagens/${viagem.id}/embarque/sessao`, mot)).data.code === "VIAGEM_NAO_INICIADA", "QR só é gerado com a viagem em andamento");
await req("POST", `/viagens/${viagem.id}/iniciar`, mot);
ok((await req("POST", `/viagens/${viagem.id}/embarque/sessao`, motOutro)).data.code === "VIAGEM_DE_OUTRO_MOTORISTA", "outro motorista não gera QR desta viagem");
ok((await req("POST", `/viagens/${viagem.id}/embarque/sessao`, ana)).data.code === "SEM_PERMISSAO", "aluno não gera QR");
const s1 = await req("POST", `/viagens/${viagem.id}/embarque/sessao`, mot);
ok(s1.status === 201 && s1.data.conteudoQr.startsWith(`BUSON1.${viagem.id}.`), "motorista gera o QR temporário da viagem", s1.data);
const minutos = Math.round((new Date(s1.data.expiraEm) - Date.now()) / 60000);
ok(minutos >= 59 && minutos <= 60, "QR vale 1 hora (configurável)", minutos);
const token1 = tokenDoQr(s1.data.conteudoQr);
ok(sql(`SELECT COUNT(*) FROM boarding_sessions WHERE tokenHash = SHA2('${token1}', 256) AND onibusId='${bus.id}'`) === "1", "banco guarda só o hash, vinculado a viagem, motorista e ônibus");

// ---- Validações do escaneamento
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, mot, { token: token1 })).data.code === "SEM_PERMISSAO", "motorista não escaneia como aluno");
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, null, { token: token1 })).data.code === "NAO_AUTENTICADO", "sem login não embarca");
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, ana, { token: "x".repeat(40) })).data.code === "QR_INVALIDO", "token inventado → QR_INVALIDO");
await req("POST", `/viagens/${outraViagem.id}/iniciar`, motOutro);
const sOutra = (await req("POST", `/viagens/${outraViagem.id}/embarque/sessao`, motOutro)).data;
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, ana, { token: tokenDoQr(sOutra.conteudoQr) })).data.code === "QR_INVALIDO", "QR de outra viagem não serve para esta");
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, caio, { token: token1 })).data.code === "ROTA_INCOMPATIVEL", "aluno de instituição fora da rota → ROTA_INCOMPATIVEL");
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, dani, { token: token1 })).data.code === "SEM_VAGA_CONFIRMADA", "aluno sem vaga confirmada não embarca");

// ---- Não dá para embarcar outra pessoa: o aluno é o do login
const comAlunoId = await req("POST", `/viagens/${viagem.id}/embarque/scan`, ana, { token: token1, alunoId: "00000000-0000-0000-0000-000000000000" });
ok(comAlunoId.status === 400 && comAlunoId.data.code === "VALIDACAO", "enviar alunoId no corpo é recusado (campos extras não aceitos)", comAlunoId.data);

// ---- Embarque válido + bloqueio de repetição
const e1 = await req("POST", `/viagens/${viagem.id}/embarque/scan`, ana, { token: token1 });
ok(e1.status === 201 && e1.data.metodo === "QR_MOTORISTA" && e1.data.viagem.onibus === "TST-QR1" && e1.data.viagem.rota === "TST Rota QR", "embarque confirmado com ônibus, rota e horário", e1.data);
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, ana, { token: token1 })).data.code === "EMBARQUE_JA_CONFIRMADO", "segundo embarque na mesma viagem é bloqueado");
const [c1, c2] = await Promise.all([1, 2].map(() => req("POST", `/viagens/${viagem.id}/embarque/scan`, beto, { token: token1 })));
ok([c1.status, c2.status].sort().join() === "201,409", "dois scans simultâneos do mesmo aluno: só um embarque", [c1.status, c2.status]);
ok(sql(`SELECT COUNT(*) FROM embarques WHERE viagemId='${viagem.id}'`) === "2", "histórico: exatamente 2 embarques registrados");

// ---- Contador do motorista
const atual = (await req("GET", "/viagens/atual", mot)).data;
ok(atual.resumo.embarcados === 2 && atual.resumo.confirmados === 3, "contador do motorista: 2 de 3 embarcados", atual.resumo);

// ---- Renovar o QR invalida o anterior; QR expirado
const s2 = (await req("POST", `/viagens/${viagem.id}/embarque/sessao`, mot)).data;
const token2 = tokenDoQr(s2.conteudoQr);
await req("POST", `/viagens/${viagem.id}/checkin`, dani); // viagem em andamento: check-in fechado
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, caio, { token: token1 })).data.code === "QR_INVALIDO", "após 'Atualizar QR' o QR antigo deixa de valer");
sql(`UPDATE boarding_sessions SET expiraEm = NOW() - INTERVAL 1 MINUTE WHERE tokenHash = SHA2('${token2}', 256)`);
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, caio, { token: token2 })).data.code === "QR_EXPIRADO", "QR vencido → QR_EXPIRADO");

// ---- Embarque manual (emergência) pelo motorista
const s3 = (await req("POST", `/viagens/${viagem.id}/embarque/sessao`, mot)).data;
const alunoCaioId = sql("SELECT a.id FROM alunos a JOIN usuarios u ON u.id=a.usuarioId WHERE u.email='tst.caio@buson.com'");
ok((await req("POST", `/viagens/${viagem.id}/embarque/manual`, ana, { alunoId: alunoCaioId })).data.code === "SEM_PERMISSAO", "aluno não usa o embarque manual");
const manual = await req("POST", `/viagens/${viagem.id}/embarque/manual`, mot, { alunoId: alunoCaioId });
ok(manual.status === 201 && manual.data.metodo === "MANUAL" && manual.data.aluno.nome === "TST Caio", "motorista confirma embarque manual", manual.data);
ok(sql(`SELECT COUNT(*) FROM auditorias WHERE entidadeId='${viagem.id}' AND acao='EMBARQUE_MANUAL'`) === "1", "embarque manual fica auditado");

// ---- Encerrar a viagem derruba o QR
await req("POST", `/viagens/${viagem.id}/encerrar`, mot);
ok(sql(`SELECT COUNT(*) FROM boarding_sessions WHERE viagemId='${viagem.id}' AND ativa=1`) === "0", "encerrar a viagem desativa o QR");
ok((await req("POST", `/viagens/${viagem.id}/embarque/scan`, dani, { token: tokenDoQr(s3.conteudoQr) })).data.code === "VIAGEM_ENCERRADA", "QR de viagem encerrada não embarca ninguém");

// ---- O fluxo antigo não existe mais
ok((await req("POST", `/viagens/${viagem.id}/embarque`, mot, { qrCode: "x" })).status === 404, "rota antiga (motorista lê QR do aluno) foi removida");

limparTST();
ok(sql("SELECT COUNT(*) FROM usuarios WHERE email LIKE 'tst.%'") === "0", "dados de teste removidos");
process.exit(resultado());
