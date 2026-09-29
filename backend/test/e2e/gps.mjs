// Fase 6 (evolução) — GPS: leituras do motorista, filtro, quem vê, distância, embarque, ao vivo, trajeto e retenção
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

limparTST();
const adm = await login("admin@buson.com");
const agora = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Imperatriz-MA: pontos de referência fictícios da cidade
const PRACA = { latitude: -5.5263, longitude: -47.4777 };
const FACULDADE = { latitude: -5.5089, longitude: -47.4633 };
const P1 = { latitude: -5.5300, longitude: -47.4810 };
const P2 = { latitude: -5.5280, longitude: -47.4795 };

function haversine(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

// ---- Coordenadas no cadastro
const uni = (await req("POST", "/universidades", adm, { nome: "TST Inst GPS" })).data;
ok((await req("PATCH", `/universidades/${uni.id}`, adm, { latitude: 100 })).data.code === "VALIDACAO", "coordenada inválida é recusada");
const uniCoord = await req("PATCH", `/universidades/${uni.id}`, adm, FACULDADE);
ok(uniCoord.status === 200 && uniCoord.data.latitude === FACULDADE.latitude, "admin define as coordenadas da instituição", uniCoord.data);
ok(sql(`SELECT COUNT(*) FROM auditorias WHERE entidadeId='${uni.id}' AND acao='INSTITUICAO_ALTERADA'`) === "1", "alteração da instituição auditada");
const ponto = (await req("POST", "/pontos-embarque", adm, { nome: "TST Praca GPS", ...PRACA })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-GPS1", capacidade: 10 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista GPS", email: "tst.motogps@buson.com", senha: "123456", onibusId: bus.id });
await req("POST", "/motoristas", adm, { nome: "TST Outro GPS", email: "tst.outrogps@buson.com", senha: "123456" });
const motoristas = (await req("GET", "/motoristas", adm)).data;
const motId = motoristas.find((m) => m.usuario.email === "tst.motogps@buson.com").id;
const mot = await login("tst.motogps@buson.com");
const outro = await login("tst.outrogps@buson.com");
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota GPS", universidadeIds: [uni.id], pontosEmbarqueIds: [ponto.id] })).data;
const viagem = async (sentido, horario) =>
  (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: motId, data: hojeISO(), horario, sentido })).data;
async function aluno(nome, email) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: "123456", universidadeId: uni.id });
  const token = await login(email);
  return { token, id: (await req("GET", "/alunos/me", token)).data.id };
}
const ana = await aluno("TST Ana GPS", "tst.anagps@buson.com");
const beto = await aluno("TST Beto GPS", "tst.betogps@buson.com");
const caio = await aluno("TST Caio GPS", "tst.caiogps@buson.com"); // sem vaga
const ida = await viagem("IDA", "23:58");
await req("POST", `/viagens/${ida.id}/checkin`, ana.token);
await req("POST", `/viagens/${ida.id}/checkin`, beto.token);
sql(`UPDATE checkins SET pontoEmbarqueId='${ponto.id}' WHERE viagemId='${ida.id}' AND alunoId='${ana.id}'`);

// ---- Envio das leituras
const leitura = (p, ms, extra = {}) => ({ ...p, registradoEm: iso(ms), precisao: 12, velocidade: 8.5, direcao: 90, ...extra });
ok((await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: [leitura(P1, agora)] })).data.code === "VIAGEM_NAO_INICIADA", "só com a viagem em andamento");
await req("POST", `/viagens/${ida.id}/iniciar`, mot);
ok((await req("POST", `/viagens/${ida.id}/localizacao`, outro, { pontos: [leitura(P1, agora)] })).data.code === "VIAGEM_DE_OUTRO_MOTORISTA", "outro motorista não envia posição desta viagem");
ok((await req("POST", `/viagens/${ida.id}/localizacao`, ana.token, { pontos: [leitura(P1, agora)] })).data.code === "SEM_PERMISSAO", "aluno não envia posição");
ok((await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: [leitura({ latitude: 91, longitude: 0 }, agora)] })).data.code === "VALIDACAO", "coordenada fora do mapa é recusada");
ok((await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: Array.from({ length: 201 }, (_, i) => leitura(P1, agora - i * 1000)) })).data.code === "VALIDACAO", "lote grande demais é recusado");
const lote = [
  leitura(P1, agora - 60_000),
  leitura(P2, agora - 30_000),
  leitura(P2, agora - 20_000, { precisao: 500 }), // imprecisa
  leitura(P2, agora - 2 * 3600_000), // velha demais
  leitura(P2, agora + 10 * 60_000), // relógio adiantado demais
];
const env1 = await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: lote });
ok(env1.status === 200 && env1.data.aceitas === 2 && env1.data.descartadas === 3, "lote: guarda as boas e descarta imprecisa, velha e adiantada", env1.data);
ok((await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: lote })).data.aceitas === 0, "reenvio do mesmo lote não duplica");
const antigo = await req("POST", `/viagens/${ida.id}/localizacao`, mot, PRACA);
ok(antigo.data.aceitas === 1, "formato antigo (uma posição) continua aceito");
ok(Number(sql(`SELECT COUNT(*) FROM localizacoes_viagem WHERE viagemId='${ida.id}'`)) === 3, "histórico com 3 posições");

// ---- Quem vê a posição
const vista = await req("GET", `/viagens/${ida.id}/localizacao`, ana.token);
const d = vista.data;
ok(vista.status === 200 && d.posicao.latitude === PRACA.latitude && d.atualizadoHaSegundos <= 5, "aluno com vaga vê a posição atual", d);
ok(d.meuDestino?.tipo === "PONTO" && d.meuDestino.distanciaMetros === 0, "na ida, distância até o ponto de embarque do aluno", d.meuDestino);
ok(d.paradas.length === 2 && d.paradas.some((p) => p.tipo === "INSTITUICAO" && p.latitude === FACULDADE.latitude), "paradas com coordenadas para o mapa", d.paradas);
ok((await req("GET", `/viagens/${ida.id}/localizacao`, caio.token)).data.code === "ACOMPANHAMENTO_NAO_PERMITIDO", "aluno sem vaga na viagem não vê o ônibus");
ok((await req("GET", `/viagens/${ida.id}/localizacao`, mot)).status === 200, "motorista da viagem vê");
ok((await req("GET", `/viagens/${ida.id}/localizacao`, outro)).data.code === "VIAGEM_DE_OUTRO_MOTORISTA", "outro motorista não vê");
ok((await req("GET", `/viagens/${ida.id}/localizacao`, adm)).status === 200, "administração vê");

// ---- Embarque registra onde foi (posição do ônibus)
await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: [leitura(P1, Date.now())] });
const qr = (await req("POST", `/viagens/${ida.id}/embarque/sessao`, mot)).data;
await req("POST", `/viagens/${ida.id}/embarque/scan`, ana.token, { token: qr.conteudoQr.split(".").slice(2).join(".") });
ok(sql(`SELECT CONCAT(latitude,',',longitude) FROM embarques WHERE viagemId='${ida.id}' AND alunoId='${ana.id}'`) === `${P1.latitude},${P1.longitude}`, "embarque pelo QR guarda a posição do ônibus");
await req("POST", `/viagens/${ida.id}/embarque/manual`, mot, { alunoId: beto.id });
ok(sql(`SELECT latitude FROM embarques WHERE viagemId='${ida.id}' AND alunoId='${beto.id}'`) === String(P1.latitude), "embarque manual também");

// ---- Administração: ao vivo e trajeto
const vivo = (await req("GET", "/viagens/ao-vivo", adm)).data.find((v) => v.id === ida.id);
ok(vivo && vivo.posicao.latitude === P1.latitude && vivo.embarcados === 2 && vivo.placa === "TST-GPS1", "viagens ao vivo com a última posição", vivo);
ok((await req("GET", "/viagens/ao-vivo", ana.token)).data.code === "SEM_PERMISSAO", "aluno não vê o painel ao vivo");
const traj = (await req("GET", `/viagens/${ida.id}/trajeto`, adm)).data;
const esperado = haversine(P1, P2) + haversine(P2, PRACA) + haversine(PRACA, P1);
ok(traj.total === 4 && Math.abs(traj.distanciaMetros - esperado) <= 2, `trajeto com distância percorrida (~${esperado} m)`, traj);

// ---- Encerrou: para de receber e o aluno deixa de ver
await req("POST", `/viagens/${ida.id}/encerrar`, mot);
ok((await req("POST", `/viagens/${ida.id}/localizacao`, mot, { pontos: [leitura(P2, Date.now())] })).data.code === "VIAGEM_ENCERRADA", "viagem encerrada não recebe posição");
const depois = (await req("GET", `/viagens/${ida.id}/localizacao`, ana.token)).data;
ok(depois.viagem.status === "ENCERRADA" && depois.posicao === null, "aluno deixa de ver o ônibus depois de encerrada");
ok((await req("GET", `/viagens/${ida.id}/localizacao`, adm)).data.posicao !== null, "administração ainda consulta o histórico");

// ---- Volta: distância até a instituição
const volta = await viagem("VOLTA", "23:59");
await req("POST", `/viagens/${volta.id}/checkin`, beto.token);
await req("POST", `/viagens/${volta.id}/iniciar`, mot);
await req("POST", `/viagens/${volta.id}/localizacao`, mot, { pontos: [leitura(P1, Date.now())] });
const naVolta = (await req("GET", `/viagens/${volta.id}/localizacao`, beto.token)).data;
ok(naVolta.meuDestino?.tipo === "INSTITUICAO" && naVolta.meuDestino.distanciaMetros === haversine(P1, FACULDADE), "na volta, distância até a instituição do aluno", naVolta.meuDestino);

// ---- Retenção: posições mais antigas que GPS_RETENCAO_DIAS são apagadas (ao subir a API e a cada 6 h)
sql(`INSERT INTO localizacoes_viagem (id, viagemId, latitude, longitude, registradoEm) VALUES (UUID(), '${volta.id}', -5.5, -47.4, DATE_SUB(NOW(3), INTERVAL 100 DAY)), (UUID(), '${volta.id}', -5.5, -47.4, DATE_SUB(NOW(3), INTERVAL 80 DAY))`);
spawnSync(process.execPath, ["dist/server.js"], { cwd: fileURLToPath(new URL("../..", import.meta.url)), env: { ...process.env, PORT: "3398", DIAS_GERACAO_VIAGENS: "0", PUSH_MODO: "desligado" }, timeout: 6000 });
ok(Number(sql(`SELECT COUNT(*) FROM localizacoes_viagem WHERE viagemId='${volta.id}' AND registradoEm < NOW() - INTERVAL 1 DAY`)) === 1, "posição com mais de 90 dias é apagada; a de 80 dias fica");

const falhas = resultado();
limparTST();
process.exit(falhas ? 1 : 0);
