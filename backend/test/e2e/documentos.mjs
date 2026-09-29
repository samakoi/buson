// Fase 3 (evolução) — documentos do aluno: envio, análise, aprovação, reprovação, reenvio e segurança
import { createHmac } from "node:crypto";
import { readdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { BASE, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

const UPLOADS = process.env.UPLOADS_DIR; // a API de teste grava aqui (pasta do scratchpad)
if (!UPLOADS) throw new Error("Defina UPLOADS_DIR igual ao da API de teste");
limparTST();
rmSync(path.join(UPLOADS, "documentos"), { recursive: true, force: true });

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100, 0)]);

function formulario(conteudo, nome, tipoMime, extra = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  if (conteudo) f.append("arquivo", new Blob([conteudo], { type: tipoMime }), nome);
  return f;
}
const enviar = (token, conteudo, nome = "declaracao.pdf", mime = "application/pdf", extra) =>
  req("POST", "/documentos", token, formulario(conteudo, nome, mime, extra));
const arquivosDe = (alunoId) => {
  const dir = path.join(UPLOADS, "documentos", alunoId);
  return existsSync(dir) ? readdirSync(dir) : [];
};
const notificacoes = (email, trecho) =>
  Number(sql(`SELECT COUNT(*) FROM notificacoes n JOIN usuarios u ON u.id=n.usuarioId WHERE u.email='${email}' AND n.mensagem LIKE '%${trecho}%'`));

// ---- Preparação
const adm = await login("admin@buson.com");
const uni = (await req("POST", "/universidades", adm, { nome: "TST Inst Doc" })).data;
const bus = (await req("POST", "/onibus", adm, { placa: "TST-DOC1", capacidade: 5 })).data;
await req("POST", "/motoristas", adm, { nome: "TST Motorista Doc", email: "tst.motodoc@buson.com", senha: "123456", onibusId: bus.id });
const mot = await login("tst.motodoc@buson.com");
async function aluno(nome, email) {
  await req("POST", "/auth/cadastro", null, { nome, email, senha: "123456", universidadeId: uni.id });
  const token = await login(email);
  return { token, id: (await req("GET", "/alunos/me", token)).data.id, email };
}
const ana = await aluno("TST Ana Doc", "tst.anadoc@buson.com");
const beto = await aluno("TST Beto Doc", "tst.betodoc@buson.com");
const caio = await aluno("TST Caio Doc", "tst.caiodoc@buson.com");
const dani = await aluno("TST Dani Doc", "tst.danidoc@buson.com");
await req("PATCH", `/alunos/${dani.id}/status`, adm, { status: "INATIVO" });

ok((await req("GET", "/alunos/me", ana.token)).data.pendencias.includes("DOCUMENTO"), "conta pendente sem documento tem a pendência DOCUMENTO");

// ---- Validações do envio
ok((await req("POST", "/documentos", ana.token, formulario(null, "", "", { tipo: "COMPROVANTE" }))).data.code === "ARQUIVO_OBRIGATORIO", "envio sem arquivo é recusado");
ok((await enviar(ana.token, EXE, "virus.pdf")).data.code === "TIPO_ARQUIVO_INVALIDO", "arquivo que não é PDF/JPG/PNG (mesmo com .pdf) é recusado");
const grande = await enviar(ana.token, Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 + 1)]));
ok(grande.status === 413 && grande.data.code === "ARQUIVO_MUITO_GRANDE", "arquivo acima de 10 MB é recusado", grande.data);
const dois = new FormData();
dois.append("arquivo", new Blob([PDF]), "a.pdf");
dois.append("arquivo", new Blob([PDF]), "b.pdf");
ok((await req("POST", "/documentos", ana.token, dois)).data.code === "VALIDACAO", "mais de um arquivo por envio é recusado");
ok((await enviar(ana.token, PDF, "x.pdf", "application/pdf", { tipo: "CARTEIRA" })).data.code === "VALIDACAO", "tipo de documento inválido é recusado");
ok(arquivosDe(ana.id).length === 0, "envios recusados não deixam arquivo no disco");
ok((await enviar(dani.token, PDF)).data.code === "CONTA_INATIVA", "conta inativa não envia documento");
ok((await enviar(mot, PDF)).data.code === "SEM_PERMISSAO", "motorista não envia documento");

// ---- Envio válido
const env1 = await enviar(ana.token, PDF, "../../declaracao ana.pdf");
ok(env1.status === 201 && env1.data.status === "PENDENTE" && env1.data.mimeType === "application/pdf", "aluno envia o comprovante (PENDENTE)", env1.data);
ok(!("arquivo" in env1.data), "a resposta não expõe o caminho do arquivo");
ok(env1.data.nomeOriginal === "declaracao ana.pdf", "nome do arquivo é limpo (sem pastas)", env1.data.nomeOriginal);
ok(arquivosDe(ana.id).length === 1, "arquivo gravado fora da pasta pública (UPLOADS_DIR/documentos/<aluno>)");
ok(!sql(`SELECT arquivo FROM documentos WHERE id='${env1.data.id}'`).includes(".."), "banco guarda só a referência (chave gerada pela API)");
const docAna = env1.data.id;
ok((await enviar(ana.token, PNG, "outro.png", "image/png")).data.code === "DOCUMENTO_AGUARDANDO_ANALISE", "segundo envio com um aguardando análise é bloqueado");
ok(arquivosDe(ana.id).length === 1, "o envio bloqueado não deixa arquivo órfão");
ok(notificacoes("admin@buson.com", "TST Ana Doc enviou") === 1, "administração é avisada do novo documento");
const eu = (await req("GET", "/alunos/me", ana.token)).data;
ok(!eu.pendencias.includes("DOCUMENTO") && eu.documento?.status === "PENDENTE", "pendência some e o status aparece para o aluno", eu);
ok((await req("GET", "/documentos/me", ana.token)).data.length === 1, "aluno vê o próprio histórico");

// Concorrência: 5 envios simultâneos → só 1 fica
const simultaneos = await Promise.all([1, 2, 3, 4, 5].map((i) => enviar(beto.token, PDF, `b${i}.pdf`)));
ok(simultaneos.filter((r) => r.status === 201).length === 1 && simultaneos.filter((r) => r.data.code === "DOCUMENTO_AGUARDANDO_ANALISE").length === 4, "5 envios simultâneos: só 1 aceito", simultaneos.map((r) => r.status));
ok(arquivosDe(beto.id).length === 1, "e só 1 arquivo fica no disco");
const docBeto = simultaneos.find((r) => r.status === 201).data.id;

// ---- Acesso ao arquivo
ok((await req("POST", `/documentos/${docAna}/link`, caio.token)).data.code === "DOCUMENTO_NAO_ENCONTRADO", "outro aluno não acessa o documento");
ok((await req("POST", `/documentos/${docAna}/link`, mot)).data.code === "DOCUMENTO_NAO_ENCONTRADO", "motorista não acessa o documento");
ok((await req("POST", `/documentos/${docAna}/link`, null)).status === 401, "sem login não gera link");
const linkDono = await req("POST", `/documentos/${docAna}/link`, ana.token);
ok(linkDono.status === 200 && linkDono.data.caminho.startsWith(`/documentos/${docAna}/arquivo?`), "dono gera link temporário", linkDono.data);
ok(sql(`SELECT status FROM documentos WHERE id='${docAna}'`) === "PENDENTE", "o próprio aluno abrir não muda o status");
const minutos = Math.round((new Date(linkDono.data.expiraEm) - Date.now()) / 60000);
ok(minutos >= 4 && minutos <= 5, "link vale 5 minutos", minutos);

const baixar = (caminho) => fetch(BASE + caminho);
const r1 = await baixar(linkDono.data.caminho);
const corpo = Buffer.from(await r1.arrayBuffer());
ok(r1.status === 200 && r1.headers.get("content-type") === "application/pdf" && corpo.equals(PDF), "link abre o arquivo original", r1.status);
ok(r1.headers.get("cache-control")?.includes("no-store") && r1.headers.get("x-content-type-options") === "nosniff", "arquivo não fica em cache e não é reinterpretado");
const adulterado = linkDono.data.caminho.replace(/assinatura=./, "assinatura=A");
const r2 = await baixar(adulterado);
ok(r2.status === 403 && (await r2.json()).error.code === "LINK_INVALIDO", "link adulterado é recusado");
const outroDoc = linkDono.data.caminho.replace(docAna, docBeto);
ok((await baixar(outroDoc)).status === 403, "assinatura de um documento não abre outro");
const segredo = process.env.JWT_SECRET; // o mesmo da API de teste (o executor define)
const expirou = Math.floor(Date.now() / 1000) - 10;
const assinaturaVelha = createHmac("sha256", segredo).update(`documento:${docAna}:${expirou}`).digest("base64url");
ok((await baixar(`/documentos/${docAna}/arquivo?expira=${expirou}&assinatura=${assinaturaVelha}`)).status === 403, "link expirado é recusado");
ok((await baixar(`/documentos/${docAna}/arquivo`)).status === 400, "sem assinatura não abre");

// Admin abre → em análise
const linkAdm = await req("POST", `/documentos/${docAna}/link`, adm);
ok(linkAdm.status === 200 && sql(`SELECT status FROM documentos WHERE id='${docAna}'`) === "EM_ANALISE", "admin abrir coloca o documento em análise");
ok(notificacoes(ana.email, "matr%cula est") === 1, "aluno é avisado que está em análise");
await req("POST", `/documentos/${docAna}/link`, adm);
ok(notificacoes(ana.email, "matr%cula est") === 1, "abrir de novo não repete o aviso");

// ---- Fila do admin
const fila = (await req("GET", "/documentos", adm)).data;
ok(fila.contagens.PENDENTE >= 1 && fila.contagens.EM_ANALISE >= 1 && fila.itens.some((d) => d.aluno.usuario.nome === "TST Ana Doc"), "fila com contagens por status", fila.contagens);
ok(fila.itens.every((d) => !("arquivo" in d)), "fila não expõe caminhos de arquivo");
const soPendentes = (await req("GET", "/documentos?status=PENDENTE&busca=TST", adm)).data;
ok(soPendentes.itens.length === 1 && soPendentes.itens[0].id === docBeto, "filtro por status e busca", soPendentes.itens.map((d) => d.aluno.usuario.nome));
ok((await req("GET", "/documentos", ana.token)).data.code === "SEM_PERMISSAO", "aluno não vê a fila");
const alunosDoc = (await req("GET", "/alunos?documentoPendente=true&busca=TST", adm)).data;
ok(alunosDoc.itens.length === 2 && alunosDoc.documentosPendentes === 2, "lista de alunos filtra 'documento pendente'", alunosDoc);
ok((await req("GET", "/dashboard/resumo", adm)).data.documentosPendentes >= 2, "dashboard mostra documentos pendentes");

// ---- Reprovação
ok((await req("POST", `/documentos/${docAna}/reprovar`, adm, {})).data.code === "VALIDACAO", "reprovar exige motivo");
ok((await req("POST", `/documentos/${docAna}/reprovar`, adm, { motivo: "ok" })).data.code === "VALIDACAO", "motivo precisa explicar (5+ letras)");
ok((await req("POST", `/documentos/${docAna}/reprovar`, ana.token, { motivo: "Ilegível" })).data.code === "SEM_PERMISSAO", "aluno não reprova");
const rep = await req("POST", `/documentos/${docAna}/reprovar`, adm, { motivo: "Declaração sem carimbo da faculdade" });
ok(rep.status === 200 && rep.data.status === "REPROVADO" && rep.data.motivoReprovacao === "Declaração sem carimbo da faculdade" && rep.data.analisadoPor?.nome, "admin reprova com motivo", rep.data);
ok(notificacoes(ana.email, "sem carimbo") === 1, "aluno recebe o motivo");
ok((await req("GET", "/alunos/me", ana.token)).data.pendencias.includes("DOCUMENTO"), "reprovado: a pendência volta");
ok((await req("POST", `/documentos/${docAna}/aprovar`, adm)).data.code === "DOCUMENTO_JA_ANALISADO", "documento já analisado não muda de novo");

// ---- Reenvio e aprovação
const env2 = await enviar(ana.token, JPG, "foto.jpg", "image/jpeg", { tipo: "DECLARACAO" });
ok(env2.status === 201 && env2.data.mimeType === "image/jpeg" && env2.data.tipo === "DECLARACAO", "aluno reenvia (foto)", env2.data);
ok((await req("GET", "/documentos/me", ana.token)).data.length === 2, "histórico mantém o reprovado");
const apr = await req("POST", `/documentos/${env2.data.id}/aprovar`, adm);
ok(apr.status === 200 && apr.data.status === "APROVADO", "admin aprova direto (sem abrir antes)", apr.data);
const anaDepois = (await req("GET", "/alunos/me", ana.token)).data;
ok(anaDepois.statusConta === "ATIVO", "aprovar ativa a conta pendente");
ok(anaDepois.pendencias.includes("DIAS_DE_USO") && !anaDepois.pendencias.includes("DOCUMENTO"), "próximo passo do aluno: escolher os dias", anaDepois.pendencias);
ok(notificacoes(ana.email, "foi aprovado") === 1 && notificacoes(ana.email, "conta foi ativada") === 1, "aluno é avisado da aprovação e da ativação");

const perfil = (await req("GET", `/alunos/${ana.id}`, adm)).data;
const acoes = perfil.historico.map((h) => h.acao);
ok(["DOCUMENTO_ENVIADO", "DOCUMENTO_EM_ANALISE", "DOCUMENTO_REPROVADO", "DOCUMENTO_APROVADO", "STATUS_CONTA_ALTERADO"].every((a) => acoes.includes(a)), "tudo fica na auditoria do aluno", acoes);
const reprovado = perfil.historico.find((h) => h.acao === "DOCUMENTO_REPROVADO");
ok(reprovado.usuario?.papel === "ADMIN" && reprovado.detalhes.motivo && reprovado.valorAnterior.documento === "EM_ANALISE", "auditoria guarda autor, motivo e antes/depois", reprovado);
ok(perfil.documentos.length === 2 && perfil.documentos.every((d) => !("arquivo" in d)), "perfil do aluno (admin) lista os documentos");

// Aprovar e reprovar ao mesmo tempo: só um vale
const [a, b] = await Promise.all([
  req("POST", `/documentos/${docBeto}/aprovar`, adm),
  req("POST", `/documentos/${docBeto}/reprovar`, adm, { motivo: "Documento de outra pessoa" }),
]);
ok([a, b].filter((r) => r.status === 200).length === 1 && [a, b].some((r) => r.data.code === "DOCUMENTO_JA_ANALISADO"), "aprovar e reprovar simultâneos: só um vale", [a.status, b.status]);
ok(sql(`SELECT status FROM documentos WHERE id='${docBeto}'`) === (a.status === 200 ? "APROVADO" : "REPROVADO"), "o banco fica com o resultado que venceu");

const falhas = resultado();
limparTST();
rmSync(path.join(UPLOADS, "documentos"), { recursive: true, force: true });
process.exit(falhas ? 1 : 0);
