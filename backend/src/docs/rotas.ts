import { AnyZodObject, ZodTypeAny } from "zod";
import * as alunos from "../modules/alunos/aluno.routes";
import * as auth from "../modules/auth/auth.controller";
import * as dashboard from "../modules/dashboard/dashboard.routes";
import * as documentos from "../modules/documentos/documento.routes";
import * as embarque from "../modules/embarque/embarque.routes";
import * as faltas from "../modules/faltas/falta.routes";
import * as motoristas from "../modules/motoristas/motorista.routes";
import * as notificacoes from "../modules/notificacoes/notificacao.routes";
import * as onibus from "../modules/onibus/onibus.routes";
import * as pontos from "../modules/pontosEmbarque/pontoEmbarque.routes";
import * as programacoes from "../modules/programacoes/programacao.routes";
import * as rotas from "../modules/rotas/rota.routes";
import * as universidades from "../modules/universidades/universidade.routes";
import * as viagens from "../modules/viagens/viagem.controller";

export interface DocRota {
  resumo: string;
  descricao?: string;
  /** Corpo JSON (o mesmo schema zod que a rota usa para validar) */
  corpo?: ZodTypeAny;
  /** Parâmetros de consulta (?chave=valor) */
  consulta?: AnyZodObject;
  /** Envio multipart/form-data: nome do campo do arquivo e os demais campos do formulário */
  arquivo?: { campo: string; outros?: AnyZodObject };
  /** Status de sucesso (padrão 200) */
  status?: 200 | 201;
}

/**
 * Descrição de cada rota, pela chave "MÉTODO /caminho" (caminho do Express, relativo a /api/v1).
 * O teste docs/openapi.test.ts falha se uma rota existir sem entrada aqui (ou vice-versa).
 */
export const documentacaoDasRotas: Record<string, DocRota> = {
  // ---- Geral
  "GET /": { resumo: "Identificação da API" },
  "GET /saude": { resumo: "Saúde da API e do banco", descricao: "Usado pelo Docker (healthcheck), pelo Cloudflare e pelo atualizar.ps1." },
  "GET /app/versao": {
    resumo: "Versão mínima do app Android",
    descricao: "O app compara com o próprio versionCode; se for menor, pede para instalar o APK novo.",
  },

  // ---- Autenticação
  "POST /auth/cadastro": {
    resumo: "Cadastro de aluno",
    corpo: auth.cadastroSchema,
    status: 201,
    descricao: "A conta nasce PENDENTE até o documento ser aprovado.",
  },
  "POST /auth/login": {
    resumo: "Login",
    corpo: auth.loginSchema,
    descricao: "Devolve accessToken (curto), refreshToken e o usuário. Limite de tentativas por IP.",
  },
  "POST /auth/refresh": {
    resumo: "Renova a sessão",
    corpo: auth.refreshSchema,
    descricao: "Rotação: devolve um novo par e invalida o refresh token usado.",
  },
  "GET /auth/me": { resumo: "Usuário logado" },
  "POST /auth/logout": { resumo: "Sai deste aparelho", corpo: auth.refreshSchema, descricao: "Revoga o refresh token informado." },
  "POST /auth/logout-todos": { resumo: "Sai de todos os aparelhos" },
  "GET /auth/sessoes": { resumo: "Sessões ativas da conta" },
  "DELETE /auth/sessoes/{id}": { resumo: "Encerra uma sessão" },

  // ---- Viagens
  "GET /viagens": {
    resumo: "Viagens visíveis para o usuário",
    descricao:
      "Admin: a partir de `desde` (hoje, por padrão), até 300. Motorista: as dele hoje. Aluno: as de hoje que passam pela universidade dele.",
    consulta: viagens.listarQuerySchema,
  },
  "GET /viagens/atual": {
    resumo: "Viagem do dia (aluno/motorista)",
    descricao: "A próxima não encerrada ou, se todas acabaram, a última.",
  },
  "GET /viagens/historico": {
    resumo: "Histórico de viagens (paginado)",
    descricao: "Mais recentes primeiro; padrão: últimos 30 dias (máximo 366). Traz o resumo de cada viagem e os totais do período.",
    consulta: viagens.historicoQuerySchema,
  },
  "GET /viagens/{id}/detalhe": {
    resumo: "Detalhe de uma viagem",
    descricao: "Horários de início e fim, números e a situação de cada passageiro (embarcou, faltou, avisou, cancelou, espera).",
  },
  "GET /viagens/ao-vivo": { resumo: "Viagens em andamento com a última posição de GPS" },
  "GET /viagens/{id}/passageiros": { resumo: "Lista de passageiros da viagem" },
  "GET /viagens/{id}/rota": { resumo: "Rota do dia com as paradas e quantos alunos em cada uma" },
  "POST /viagens": { resumo: "Cria uma viagem avulsa", corpo: viagens.novaViagemSchema, status: 201 },
  "DELETE /viagens/{id}": { resumo: "Exclui uma viagem ainda não iniciada" },
  "POST /viagens/{id}/checkin": { resumo: "Confirma presença", descricao: "Sem vaga, entra na lista de espera." },
  "POST /viagens/{id}/checkin/cancelar": {
    resumo: "Avisa que não vai",
    corpo: viagens.cancelamentoSchema,
    descricao: "Libera a vaga e promove o próximo da espera.",
  },
  "POST /viagens/{id}/iniciar": { resumo: "Motorista inicia a viagem" },
  "POST /viagens/{id}/encerrar": { resumo: "Motorista encerra a viagem", descricao: "Na ida, quem não embarcou recebe falta automática." },
  "POST /viagens/{id}/localizacao": {
    resumo: "Envia posições de GPS do ônibus",
    corpo: viagens.localizacaoSchema,
    descricao: "Uma leitura ou um lote (as que ficaram guardadas sem internet).",
  },
  "GET /viagens/{id}/localizacao": { resumo: "Última posição do ônibus" },
  "GET /viagens/{id}/trajeto": { resumo: "Trajeto percorrido (pontos de GPS)" },
  "POST /viagens/{id}/embarque/sessao": { resumo: "Gera o QR temporário de embarque", status: 201 },
  "POST /viagens/{id}/embarque/scan": { resumo: "Aluno escaneia o QR do motorista", corpo: embarque.scanSchema },
  "POST /viagens/{id}/embarque/manual": { resumo: "Embarque manual pelo motorista", corpo: embarque.manualSchema },

  // ---- Cadastros
  "GET /universidades": { resumo: "Lista de universidades", descricao: "Pública: usada na tela de cadastro do aluno." },
  "POST /universidades": { resumo: "Cadastra universidade", corpo: universidades.schema, status: 201 },
  "PATCH /universidades/{id}": { resumo: "Altera universidade", corpo: universidades.schema.partial() },
  "DELETE /universidades/{id}": { resumo: "Exclui universidade" },
  "GET /onibus/status": { resumo: "Ônibus e quais estão em manutenção" },
  "GET /onibus": { resumo: "Lista de ônibus" },
  "POST /onibus": { resumo: "Cadastra ônibus", corpo: onibus.schema, status: 201 },
  "PATCH /onibus/{id}": { resumo: "Altera ônibus", corpo: onibus.schema.partial() },
  "PATCH /onibus/{id}/manutencao": {
    resumo: "Liga/desliga a manutenção",
    corpo: onibus.manutencaoSchema,
    descricao: "Avisa os alunos das próximas viagens desse ônibus.",
  },
  "DELETE /onibus/{id}": { resumo: "Exclui ônibus" },
  "GET /rotas": {
    resumo: "Rotas disponíveis com os trechos de ida e volta",
    descricao: "As excluídas ficam de fora. `pontos`/`pontosEmbarque` repetem a ida, para versões anteriores do app.",
  },
  "GET /rotas/{id}": { resumo: "Uma rota com os trechos de ida e volta" },
  "POST /rotas": {
    resumo: "Cadastra rota",
    corpo: rotas.schema,
    status: 201,
    descricao: "Com `ida` e `volta` (origem, destino, instituições e pontos de cada trecho) ou no formato antigo, com uma lista só.",
  },
  "PATCH /rotas/{id}": {
    resumo: "Altera rota",
    corpo: rotas.edicaoSchema,
    descricao: "Cada trecho enviado substitui as paradas daquele sentido. Com `versao`, recusa se outra pessoa salvou antes (409).",
  },
  "GET /rotas/{id}/impacto-exclusao": {
    resumo: "O que a exclusão da rota afeta",
    descricao: "Alunos com dias fixos, viagens e reservas futuras, viagem em andamento e viagens que ficam no histórico.",
  },
  "DELETE /rotas/{id}": {
    resumo: "Exclui a rota (exclusão lógica)",
    consulta: rotas.exclusaoQuerySchema,
    descricao:
      "Com vínculos, exige `confirmarVinculos=true` (senão 409 ROTA_COM_VINCULOS com as contagens). Cancela as viagens futuras com aviso, encerra a programação, libera os dias fixos dos alunos (com aviso) e preserva o histórico. Viagem em andamento bloqueia.",
  },
  "GET /motoristas": { resumo: "Lista de motoristas" },
  "POST /motoristas": { resumo: "Cadastra motorista (cria o usuário)", corpo: motoristas.schema, status: 201 },
  "DELETE /motoristas/{id}": { resumo: "Exclui motorista" },
  "GET /pontos-embarque": { resumo: "Pontos de embarque" },
  "POST /pontos-embarque": { resumo: "Cadastra ponto de embarque", corpo: pontos.schema, status: 201 },
  "PATCH /pontos-embarque/{id}": { resumo: "Altera ponto de embarque", corpo: pontos.schema.partial() },
  "DELETE /pontos-embarque/{id}": { resumo: "Exclui ponto de embarque" },

  // ---- Dashboard
  "GET /dashboard/resumo": { resumo: "Indicadores gerais" },
  "GET /dashboard/ocupacao-semanal": { resumo: "Ocupação por dia da semana (alocados / capacidade)" },
  "GET /dashboard/checkins-por-dia": { resumo: "Check-ins dos últimos 7 dias" },
  "GET /dashboard/ocupacao-por-universidade": { resumo: "Alunos cadastrados por universidade" },
  "GET /dashboard/relatorio": { resumo: "Presença e faltas do período", consulta: dashboard.relatorioSchema },

  // ---- Avisos e push
  "GET /notificacoes": { resumo: "Últimos 50 avisos e quantos não foram lidos" },
  "POST /notificacoes/lidas": { resumo: "Marca todos os avisos como lidos" },
  "POST /notificacoes/dispositivos": { resumo: "Registra o aparelho para push", corpo: notificacoes.dispositivoSchema, status: 201 },
  "POST /notificacoes/dispositivos/remover": { resumo: "Remove o aparelho do push", corpo: notificacoes.removerDispositivoSchema },
  "GET /notificacoes/preferencias": { resumo: "Tipos de push desligados" },
  "PUT /notificacoes/preferencias": { resumo: "Liga/desliga tipos de push", corpo: notificacoes.preferenciasSchema },

  // ---- Alunos
  "GET /alunos/me": { resumo: "Cadastro do aluno logado (status, pendências, documento)" },
  "PATCH /alunos/me": { resumo: "Atualiza os dados acadêmicos", corpo: alunos.dadosSchema },
  "GET /alunos/me/dias": { resumo: "Dias fixos do aluno e a disponibilidade de cada dia" },
  "PUT /alunos/me/dias": {
    resumo: "Escolhe os dias fixos",
    corpo: alunos.diasSchema,
    descricao: "Valida a capacidade por dia; com algum dia lotado responde 409 com a lista.",
  },
  "GET /alunos/{id}/dias": { resumo: "Dias fixos de um aluno" },
  "PUT /alunos/{id}/dias": { resumo: "Define os dias fixos de um aluno", corpo: alunos.diasSchema },
  "GET /alunos": { resumo: "Busca de alunos (paginada)", consulta: alunos.listarSchema },
  "GET /alunos/{id}": { resumo: "Perfil completo do aluno", descricao: "Dados, documentos, dias, faltas e histórico de alterações." },
  "PATCH /alunos/{id}/status": { resumo: "Ativa/inativa a conta", corpo: alunos.statusSchema },

  // ---- Programação semanal
  "GET /programacoes": { resumo: "Programações semanais" },
  "POST /programacoes/gerar": { resumo: "Gera agora as viagens dos próximos dias", descricao: "O agendador já faz isso a cada hora." },
  "GET /programacoes/{id}": { resumo: "Uma programação" },
  "GET /programacoes/{id}/ocupacao": { resumo: "Ocupação por dia da programação" },
  "POST /programacoes": {
    resumo: "Cria a viagem programada",
    corpo: programacoes.criarSchema,
    status: 201,
    descricao: "Com uma rota existente (`rotaId`) ou criando a rota junto (`rota`, com os trechos de ida e volta).",
  },
  "PATCH /programacoes/{id}": {
    resumo: "Altera a viagem programada",
    corpo: programacoes.atualizarSchema,
    descricao: "Inclui os trechos da rota (`rota`). Com `versao`, recusa se outra pessoa salvou antes (409 EDICAO_CONFLITANTE).",
  },
  "DELETE /programacoes/{id}": { resumo: "Exclui programação" },

  // ---- Documentos
  "GET /documentos/{id}/arquivo": {
    resumo: "Baixa o arquivo por link assinado",
    consulta: documentos.arquivoSchema,
    descricao: "Sem login: o link (gerado em POST /documentos/{id}/link) vale poucos minutos.",
  },
  "POST /documentos": {
    resumo: "Envia o comprovante de matrícula",
    arquivo: { campo: "arquivo", outros: documentos.envioSchema },
    status: 201,
    descricao: "PDF, JPG ou PNG até 10 MB.",
  },
  "GET /documentos/me": { resumo: "Documentos do aluno logado" },
  "POST /documentos/{id}/link": { resumo: "Gera link assinado para abrir o arquivo", descricao: "Só o dono ou a administração." },
  "GET /documentos": { resumo: "Fila de documentos (paginada)", consulta: documentos.listarSchema },
  "POST /documentos/{id}/aprovar": { resumo: "Aprova o documento", descricao: "Ativa a conta e os dias pedidos onde houver vaga." },
  "POST /documentos/{id}/reprovar": { resumo: "Reprova o documento", corpo: documentos.reprovarSchema },

  // ---- Faltas
  "GET /faltas/{id}/anexo": { resumo: "Baixa o anexo da justificativa por link assinado", consulta: faltas.anexoSchema },
  "GET /faltas/me": { resumo: "Faltas e ausências avisadas do aluno logado" },
  "POST /faltas/{id}/justificativa": {
    resumo: "Aluno justifica uma falta",
    arquivo: { campo: "anexo", outros: faltas.justificativaSchema },
    descricao: "Anexo opcional (PDF, JPG ou PNG).",
  },
  "POST /faltas/{id}/anexo/link": { resumo: "Gera link assinado para o anexo" },
  "GET /faltas": { resumo: "Faltas (paginada, com filtros e contagens)", consulta: faltas.listarSchema },
  "POST /faltas/{id}/justificar": { resumo: "Administração aceita a justificativa", corpo: faltas.justificarSchema },
  "POST /faltas/{id}/indeferir": { resumo: "Administração indefere a justificativa", corpo: faltas.indeferirSchema },
};
