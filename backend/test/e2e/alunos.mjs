// Fase 1 — gestão de alunos, notificações nos 3 perfis e auditoria
import { hojeISO, limparTST, login, ok, req, resultado, sql } from "./lib.mjs";

limparTST();
const adm = await login("admin@buson.com");
const mot = await login("motorista@buson.com");
const uni = (await req("POST", "/universidades", adm, { nome: "TST Universidade A" })).data;

// Cadastro entra PENDENTE, admin é avisado e fica registrado
const naoLidasAntes = (await req("GET", "/notificacoes", adm)).data.naoLidas;
const cad = await req("POST", "/auth/cadastro", null, { nome: "TST Joana Lima", email: "tst.joana@buson.com", senha: "123456", universidadeId: uni.id });
ok(cad.status === 201, "cadastro do aluno", cad.data);
const aluno = await login("tst.joana@buson.com");
const me = (await req("GET", "/alunos/me", aluno)).data;
ok(me.statusConta === "PENDENTE", "novo aluno entra como PENDENTE", me.statusConta);
ok(me.pendencias.includes("DADOS_ACADEMICOS"), "pendência de dados acadêmicos aparece", me.pendencias);
const avisosAdm = (await req("GET", "/notificacoes", adm)).data;
ok(avisosAdm.naoLidas === naoLidasAntes + 1 && avisosAdm.itens[0].mensagem.includes("TST Joana") && avisosAdm.itens[0].categoria === "CADASTRO", "admin recebe aviso de novo cadastro", avisosAdm.itens[0]);

// Dados acadêmicos
const telRuim = await req("PATCH", "/alunos/me", aluno, { telefone: "123" });
ok(telRuim.status === 400 && telRuim.data.erro.includes("Telefone"), "telefone inválido → mensagem clara", telRuim.data);
const dados = await req("PATCH", "/alunos/me", aluno, { matricula: "TST2026001", curso: "Engenharia Civil", telefone: "(99) 98888-7777" });
ok(dados.status === 200 && dados.data.telefone === "99988887777" && !dados.data.pendencias.includes("DADOS_ACADEMICOS") && dados.data.pendencias.join() === "DOCUMENTO", "dados acadêmicos salvos (telefone normalizado); falta só o documento", dados.data);

// Outro aluno não pode usar a mesma matrícula
await req("POST", "/auth/cadastro", null, { nome: "TST Pedro Souza", email: "tst.pedro@buson.com", senha: "123456", universidadeId: uni.id });
const pedro = await login("tst.pedro@buson.com");
const dup = await req("PATCH", "/alunos/me", pedro, { matricula: "TST2026001" });
ok(dup.status === 409 && dup.data.erro.includes("matrícula"), "matrícula duplicada → 409", dup.data);

// Lista do admin: busca e filtros
const porNome = (await req("GET", "/alunos?busca=joana", adm)).data;
ok(porNome.itens.length === 1 && porNome.itens[0].usuario.nome === "TST Joana Lima", "busca por nome (sem diferenciar maiúsculas)", porNome.itens.map((i) => i.usuario.nome));
const porMatricula = (await req("GET", "/alunos?busca=TST2026001", adm)).data;
ok(porMatricula.total === 1, "busca por matrícula", porMatricula.total);
const porUni = (await req("GET", `/alunos?universidadeId=${uni.id}`, adm)).data;
ok(porUni.total === 2 && porUni.contagens.PENDENTE === 2, "filtro por universidade + contagem por status", porUni.contagens);
const pendentes = (await req("GET", `/alunos?status=PENDENTE&universidadeId=${uni.id}`, adm)).data;
ok(pendentes.total === 2, "filtro por status", pendentes.total);
ok((await req("GET", "/alunos", aluno)).status === 403, "aluno não acessa a lista de alunos");
ok(!JSON.stringify(porUni).includes("senhaHash"), "lista não vaza senhaHash");

// Ativar / inativar com auditoria e aviso
const joanaId = porNome.itens[0].id;
const ativado = await req("PATCH", `/alunos/${joanaId}/status`, adm, { status: "ATIVO" });
ok(ativado.status === 200 && ativado.data.statusConta === "ATIVO", "admin ativa o aluno", ativado.data);
const inativado = await req("PATCH", `/alunos/${joanaId}/status`, adm, { status: "INATIVO", motivo: "TST trancou o semestre" });
ok(inativado.data.statusConta === "INATIVO" && inativado.data.historico.length >= 3, "histórico registra cadastro e mudanças de status", inativado.data.historico?.map((h) => h.acao));
ok(inativado.data.historico[0].detalhes.motivo === "TST trancou o semestre" && inativado.data.historico[0].usuario.papel === "ADMIN", "auditoria guarda motivo e quem fez", inativado.data.historico[0]);
const avisosJoana = (await req("GET", "/notificacoes", aluno)).data;
ok(avisosJoana.itens[0].mensagem.includes("inativada") && avisosJoana.itens[0].categoria === "CADASTRO", "aluno é avisado da inativação", avisosJoana.itens[0]);

// Aluno inativo não faz check-in
const bus = (await req("POST", "/onibus", adm, { placa: "TST-F1", capacidade: 10 })).data;
const moto = (await req("POST", "/motoristas", adm, { nome: "TST Motorista F1", email: "tst.motof1@buson.com", senha: "123456" })).data;
const rota = (await req("POST", "/rotas", adm, { nome: "TST Rota F1", universidadeIds: [uni.id] })).data;
const viagem = (await req("POST", "/viagens", adm, { rotaId: rota.id, onibusId: bus.id, motoristaId: moto.id, data: hojeISO(), horario: "23:59" })).data;
const ck = await req("POST", `/viagens/${viagem.id}/checkin`, aluno);
ok(ck.status === 403 && ck.data.erro.includes("inativa"), "aluno INATIVO não consegue check-in", ck.data);
ok((await req("POST", `/viagens/${viagem.id}/checkin`, pedro)).status === 201, "aluno PENDENTE pode pedir vaga avulsa");

// Avisos nos 3 perfis
ok((await req("GET", "/notificacoes", mot)).status === 200, "motorista acessa os próprios avisos");
await req("POST", "/notificacoes/lidas", adm);
ok((await req("GET", "/notificacoes", adm)).data.naoLidas === 0, "admin marca avisos como lidos");

// Notificações antigas (migradas de aluno → usuário) continuam acessíveis
const marina = await login("aluno@buson.com");
ok((await req("GET", "/notificacoes", marina)).status === 200, "aluno do seed continua vendo seus avisos após a migração");

limparTST();
ok(sql("SELECT COUNT(*) FROM usuarios WHERE email LIKE 'tst.%'") === "0", "dados de teste removidos");
process.exit(resultado());
