// Fase 5 (evolução) — notificações/push: aparelhos, fila, preferências, tokens inválidos, recibos e lembretes
// A API de teste roda com PUSH_MODO=teste (carteiro falso) e ciclos curtos:
//   PUSH_INTERVALO_MS=300 RECIBOS_INTERVALO_MS=600 RECIBOS_ESPERA_MS=0 LEMBRETES_INTERVALO_MS=1000 LEMBRETE_VESPERA_HORARIO=00:00
import { hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

limparTST();
const R = Date.now().toString(36);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const adm = await login("admin@buson.com");
const enviados = async (token) => (await req("GET", `/notificacoes/push-teste/enviados?para=${encodeURIComponent(token)}`, adm)).data;
const statusPush = (email, trecho) =>
  sql(`SELECT n.pushStatus FROM notificacoes n JOIN usuarios u ON u.id=n.usuarioId WHERE u.email='${email}' AND n.mensagem LIKE '%${trecho}%' ORDER BY n.criadoEm DESC LIMIT 1`);
const contar = (email, trecho) =>
  Number(sql(`SELECT COUNT(*) FROM notificacoes n JOIN usuarios u ON u.id=n.usuarioId WHERE u.email='${email}' AND n.mensagem LIKE '%${trecho}%'`));
const ativo = (token) => sql(`SELECT CONCAT(ativo,'/',IFNULL(motivoDesativacao,'-')) FROM dispositivos_push WHERE token='${token}'`);

// ---- Preparação
const uni = (await req("POST", "/universidades", adm, { nome: "TST Inst Push" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-PUS1", capacidade: 10 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista Push", email: "tst.motopush@buson.com", senha: "123456", onibusId: bus.id });
const motId = (await req("GET", "/motoristas", adm)).data.find((m) => m.usuario.email === "tst.motopush@buson.com").id;
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota Push", universidadeIds: [uni.id] })).data;
async function aluno(nome, email) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: "123456", universidadeId: uni.id });
  const token = await login(email);
  const id = (await req("GET", "/alunos/me", token)).data.id;
  await req("PATCH", `/alunos/${id}/status`, adm, { status: "ATIVO" });
  return { token, id, email };
}
const alunos = {};
for (const n of ["ana", "bia", "caio", "dani", "eva"]) alunos[n] = await aluno(`TST ${n[0].toUpperCase()}${n.slice(1)} Push`, `tst.${n}push@buson.com`);
const viagem = async (dia, horario) => (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: motId, data: dia, horario })).data;
const t = { ana1: `ExponentPushToken[tst-ana-cel-${R}]`, ana2: `ExponentPushToken[tst-ana-tablet-${R}]` };

// ---- Registro de aparelhos
ok((await req("POST", "/notificacoes/dispositivos", alunos.ana.token, { token: "nao-e-um-token-expo", plataforma: "ANDROID" })).data.code === "PUSH_TOKEN_INVALIDO", "token fora do padrão Expo é recusado");
ok((await req("POST", "/notificacoes/dispositivos", null, { token: t.ana1, plataforma: "ANDROID" })).status === 401, "sem login não registra aparelho");
const r1 = await req("POST", "/notificacoes/dispositivos", alunos.ana.token, { token: t.ana1, plataforma: "ANDROID", deviceId: "tst-cel-ana" });
ok(r1.status === 201 && r1.data.ativo === true && !("token" in r1.data), "aluno registra o celular", r1.data);
ok((await req("POST", "/notificacoes/dispositivos", alunos.ana.token, { token: t.ana2, plataforma: "IOS", deviceId: "tst-tab-ana" })).status === 201, "e um segundo aparelho");
ok(Number(sql(`SELECT COUNT(*) FROM dispositivos_push WHERE token LIKE '%[tst-ana-%' AND ativo=1`)) === 2, "vários aparelhos por usuário");

// ---- Evento → push nos dois aparelhos
const v1 = await viagem(hojeISO(3), "22:00");
await req("POST", `/viagens/${v1.id}/checkin`, alunos.ana.token);
await esperar(1200);
const [m1] = await enviados(t.ana1);
ok(m1 && m1.corpo.includes("vaga foi confirmada") && m1.titulo === "Transporte" && m1.dados.categoria === "TRANSPORTE" && m1.dados.papel === "ALUNO", "aviso chega no celular (título, texto e dados para abrir a tela)", m1);
ok((await enviados(t.ana2)).length === 1, "e no segundo aparelho");
ok(statusPush(alunos.ana.email, "vaga foi confirmada") === "ENVIADO", "aviso marcado como enviado");
ok(sql(`SELECT COUNT(*) FROM envios_push e JOIN dispositivos_push d ON d.id=e.dispositivoId WHERE d.token LIKE '%[tst-ana-%' AND e.status IN ('ENVIADO','ENTREGUE') AND e.ticketId IS NOT NULL`) === "2", "um envio (ticket) por aparelho");
await esperar(1500);
ok(sql(`SELECT COUNT(*) FROM envios_push e JOIN dispositivos_push d ON d.id=e.dispositivoId WHERE d.token LIKE '%[tst-ana-%' AND e.status='ENTREGUE'`) === "2", "recibos conferidos: entregues");

// ---- Preferências
const pref = (await req("GET", "/notificacoes/preferencias", alunos.ana.token)).data;
ok(pref.desligaveis.join() === "LEMBRETE,TRANSPORTE" && pref.desligadas.length === 0, "preferências: só lembretes e transporte são desligáveis", pref);
ok((await req("PUT", "/notificacoes/preferencias", alunos.ana.token, { desligadas: ["FALTA"] })).data.code === "VALIDACAO", "avisos essenciais não podem ser desligados");
ok((await req("PUT", "/notificacoes/preferencias", alunos.ana.token, { desligadas: ["TRANSPORTE"] })).data.desligadas.join() === "TRANSPORTE", "aluno desliga avisos de transporte");
await req("POST", `/viagens/${v1.id}/checkin/cancelar`, alunos.ana.token);
await esperar(1000);
ok(statusPush(alunos.ana.email, "vaga foi liberada") === "DESLIGADO" && (await enviados(t.ana1)).length === 1, "aviso desligado não vai para o celular");
ok((await req("GET", "/notificacoes", alunos.ana.token)).data.itens.some((n) => n.mensagem.includes("vaga foi liberada")), "mas continua na aba Avisos");
await req("POST", `/viagens/${v1.id}/checkin`, alunos.ana.token);
await req("DELETE", `/viagens/${v1.id}`, adm);
await esperar(1000);
ok(statusPush(alunos.ana.email, "foi cancelada") === "ENVIADO" && (await enviados(t.ana1)).some((m) => m.corpo.includes("foi cancelada") && m.dados.categoria === "VIAGEM"), "viagem cancelada chega mesmo com transporte desligado");

// ---- Tokens com problema
await req("POST", "/notificacoes/dispositivos", alunos.bia.token, { token: `ExponentPushToken[tst-invalido-bia-${R}]`, plataforma: "ANDROID" });
await req("POST", "/notificacoes/dispositivos", alunos.caio.token, { token: `ExponentPushToken[tst-recibo-invalido-caio-${R}]`, plataforma: "ANDROID" });
await req("POST", "/notificacoes/dispositivos", alunos.dani.token, { token: `ExponentPushToken[tst-instavel-dani-${R}]`, plataforma: "ANDROID" });
const v2 = await viagem(hojeISO(3), "22:30");
for (const n of ["bia", "caio", "dani", "eva"]) await req("POST", `/viagens/${v2.id}/checkin`, alunos[n].token);
await esperar(1500);
ok(ativo(`ExponentPushToken[tst-invalido-bia-${R}]`) === "0/DeviceNotRegistered" && statusPush(alunos.bia.email, "vaga foi confirmada") === "SEM_DISPOSITIVO", "token recusado pelo Expo é desativado na hora");
ok(ativo(`ExponentPushToken[tst-recibo-invalido-caio-${R}]`) === "0/DeviceNotRegistered" && statusPush(alunos.caio.email, "vaga foi confirmada") === "ENVIADO", "recibo DeviceNotRegistered desativa o aparelho depois");
ok(statusPush(alunos.eva.email, "vaga foi confirmada") === "SEM_DISPOSITIVO", "aluno sem aparelho: aviso fica só no app");
await esperar(1500);
ok(sql(`SELECT CONCAT(n.pushStatus,'/',n.pushTentativas) FROM notificacoes n JOIN usuarios u ON u.id=n.usuarioId WHERE u.email='${alunos.dani.email}' ORDER BY n.criadoEm DESC LIMIT 1`) === "FALHOU/5", "falha passageira tenta de novo até 5 vezes");

// Aviso antigo que ficou pendente não sai mais
sql(`INSERT INTO notificacoes (id, usuarioId, categoria, mensagem, lida, criadoEm, pushStatus, pushTentativas) SELECT UUID(), a.usuarioId, 'GERAL', 'TST aviso antigo', 0, DATE_SUB(NOW(3), INTERVAL 2 DAY), 'PENDENTE', 0 FROM alunos a WHERE a.id='${alunos.ana.id}'`);
await esperar(800);
ok(statusPush(alunos.ana.email, "TST aviso antigo") === "IGNORADO" && !(await enviados(t.ana1)).some((m) => m.corpo.includes("antigo")), "aviso com mais de 24 h não vai para o celular");

// ---- Aparelho trocando de dono / token novo / logout
await req("POST", "/notificacoes/dispositivos", alunos.bia.token, { token: t.ana2, plataforma: "IOS", deviceId: "tst-tab-bia" });
ok(sql(`SELECT u.email FROM dispositivos_push d JOIN usuarios u ON u.id=d.usuarioId WHERE d.token='${t.ana2}'`) === alunos.bia.email, "token usado por outro usuário passa para quem entrou");
await req("POST", "/notificacoes/dispositivos", alunos.ana.token, { token: `ExponentPushToken[tst-ana-cel-novo-${R}]`, plataforma: "ANDROID", deviceId: "tst-cel-ana" });
ok(ativo(t.ana1).startsWith("0/") && ativo(`ExponentPushToken[tst-ana-cel-novo-${R}]`) === "1/-", "mesmo aparelho com token novo: o antigo sai");
const sessao = (await req("POST", "/auth/login", null, { email: alunos.ana.email, senha: "123456", deviceId: "tst-cel-ana" })).data;
await req("POST", "/auth/logout", sessao.accessToken, { refreshToken: sessao.refreshToken });
ok(ativo(`ExponentPushToken[tst-ana-cel-novo-${R}]`) === "0/Saiu do aparelho", "sair do aparelho desliga o push dele");
await req("POST", "/notificacoes/dispositivos", alunos.bia.token, { token: `ExponentPushToken[tst-bia-cel-${R}]`, plataforma: "ANDROID", deviceId: "tst-cel-bia" });
await req("POST", "/auth/logout-todos", alunos.bia.token);
ok(Number(sql(`SELECT COUNT(*) FROM dispositivos_push d JOIN usuarios u ON u.id=d.usuarioId WHERE u.email='${alunos.bia.email}' AND d.ativo=1`)) === 0, "sair de todos desliga o push de todos os aparelhos");
alunos.bia.token = await login(alunos.bia.email);
await req("POST", "/notificacoes/dispositivos", alunos.bia.token, { token: `ExponentPushToken[tst-bia-cel2-${R}]`, plataforma: "ANDROID" });
await req("POST", "/notificacoes/dispositivos/remover", alunos.bia.token, { token: `ExponentPushToken[tst-bia-cel2-${R}]` });
ok(ativo(`ExponentPushToken[tst-bia-cel2-${R}]`).startsWith("0/"), "o app pode remover o próprio aparelho");

// ---- Admin recebe push dos eventos
await req("POST", "/notificacoes/dispositivos", adm, { token: `ExponentPushToken[tst-admin-cel-${R}]`, plataforma: "ANDROID" });
const doc = new FormData();
doc.append("arquivo", new Blob([Buffer.from("%PDF-1.4\n%%EOF\n")]), "d.pdf");
await req("POST", "/documentos", (await login(alunos.eva.email)), doc);
await esperar(1000);
ok((await enviados(`ExponentPushToken[tst-admin-cel-${R}]`)).some((m) => m.corpo.includes("TST Eva Push enviou um documento") && m.dados.papel === "ADMIN"), "admin recebe push quando chega documento para analisar");

// ---- Lembretes de viagem
await req("PUT", "/notificacoes/preferencias", alunos.ana.token, { desligadas: [] });
alunos.ana.token = await login(alunos.ana.email);
await req("POST", "/notificacoes/dispositivos", alunos.ana.token, { token: `ExponentPushToken[tst-ana-cel3-${R}]`, plataforma: "ANDROID" });
// Criada longe do horário para os check-ins entrarem antes; depois move para daqui a 30 min
const saida = await viagem(hojeISO(4), "21:00");
await req("POST", `/viagens/${saida.id}/checkin`, alunos.ana.token);
await req("POST", `/viagens/${saida.id}/checkin`, await login(alunos.eva.email));
sql(`UPDATE checkins SET status='PROGRAMADO' WHERE viagemId='${saida.id}' AND alunoId='${alunos.eva.id}'`);
sql(`UPDATE viagens SET data = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE) WHERE id='${saida.id}'`);
await esperar(2500);
ok(contar(alunos.ana.email, "Sua ida sai") === 1 && (await enviados(`ExponentPushToken[tst-ana-cel3-${R}]`)).some((m) => m.titulo === "Lembrete de viagem"), "lembrete antes da saída chega no celular");
ok(contar(alunos.eva.email, "Confirme sua presen") === 1, "quem tem dia fixo sem confirmar é lembrado de confirmar");
ok(contar("tst.motopush@buson.com", "Sua viagem de ida sai") === 1, "motorista recebe o lembrete com o número de passageiros");
await esperar(2000);
ok(contar(alunos.ana.email, "Sua ida sai") === 1, "o lembrete não se repete");

const vespera = await viagem(hojeISO(5), "06:30");
await req("POST", `/viagens/${vespera.id}/checkin`, alunos.caio.token);
sql(`UPDATE viagens SET data = DATE_ADD(data, INTERVAL -${5 - 1} DAY) WHERE id='${vespera.id}'`);
await esperar(2500);
ok(contar(alunos.caio.email, "tem transporte: ida %s 06:30") === 1, "lembrete da véspera com as viagens de amanhã");
ok(contar("tst.motopush@buson.com", "voc% dirige: ida") === 1, "motorista recebe o resumo da véspera");
await esperar(2000);
ok(contar(alunos.caio.email, "tem transporte: ida") === 1, "véspera também não se repete");
await req("PUT", "/notificacoes/preferencias", alunos.caio.token, { desligadas: ["LEMBRETE"] });
const outro = await viagem(hojeISO(4), "20:00");
await req("POST", `/viagens/${outro.id}/checkin`, alunos.caio.token);
sql(`UPDATE viagens SET data = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 20 MINUTE) WHERE id='${outro.id}'`);
await esperar(2500);
ok(statusPush(alunos.caio.email, "ida sai") === "DESLIGADO", "lembrete desligado nas preferências fica só no app");

const falhas = resultado();
if (!process.env.MANTER) limparTST();
process.exit(falhas ? 1 : 0);
