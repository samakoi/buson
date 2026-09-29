export type Papel = "ALUNO" | "MOTORISTA" | "ADMIN";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

/** Resposta de GET /auth/me */
export interface Perfil extends Usuario {
  aluno: {
    id: string;
    universidade: { id: string; nome: string };
    statusConta: StatusConta;
  } | null;
}

/** PROGRAMADO = alocado no dia (vaga garantida), ainda sem confirmar a presença */
export type StatusCheckin = "CONFIRMADO" | "PROGRAMADO" | "ESPERA" | "CANCELADO";
export type SentidoViagem = "IDA" | "VOLTA";
export type StatusViagem = "AGUARDANDO" | "EM_ANDAMENTO" | "ENCERRADA";

export interface Onibus {
  id: string;
  placa: string;
  capacidade: number;
  emManutencao: boolean;
  observacaoManutencao: string | null;
}

export interface Universidade {
  id: string;
  nome: string;
}

export interface PontoEmbarque {
  id: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
  _count?: { rotas: number };
}

export interface Rota {
  id: string;
  nome: string;
  pontos: { id: string; ordem: number; universidade: Universidade }[];
  pontosEmbarque: { id: string; ordem: number; pontoEmbarque: PontoEmbarque }[];
}

export interface Motorista {
  id: string;
  onibusId: string | null;
  usuario: { id: string; nome: string; email: string };
  onibus: { id: string; placa: string } | null;
}

export interface ResumoViagem {
  confirmados: number;
  /** Alocados no dia que ainda não confirmaram */
  programados: number;
  /** confirmados + programados = lugares ocupados */
  ocupados: number;
  embarcados: number;
  espera: number;
}

export interface Viagem {
  id: string;
  data: string;
  horario: string;
  vagas: number;
  status: StatusViagem;
  sentido: SentidoViagem;
  /** Gerada pela programação semanal (null = criada avulsa) */
  programacaoId: string | null;
  latitude?: number;
  longitude?: number;
  rota: { nome: string };
  onibus: Onibus;
  motorista?: { usuario: { nome: string } };
  resumo: ResumoViagem;
  /** Só vem para o aluno */
  vagasRestantes?: number;
  /** Só vem para o aluno: o check-in dele nesta viagem */
  meuCheckin?: {
    status: StatusCheckin;
    embarcado: boolean;
    embarcadoEm?: string | null;
    posicaoFila: number | null;
    pontoEmbarque: { id: string; nome: string } | null;
    /** Vaga liberada antes da saída: motivo informado (ou FALTOU_NA_IDA, pelo sistema) */
    motivoAusencia: MotivoAusencia | null;
  } | null;
}

export interface Checkin {
  id: string;
  alunoId: string;
  status: StatusCheckin;
  embarcado: boolean;
  pontoEmbarque: { id: string; nome: string } | null;
  aluno: {
    universidade: { nome: string };
    usuario: { nome: string };
  };
}

/** GET /viagens/:id/rota */
export interface RotaDoDia {
  sentido: SentidoViagem;
  universidades: { universidade: string; alunosConfirmados: number; ativoNoDia: boolean }[];
  pontosEmbarque: { id: string; nome: string; endereco: string | null; alunos: number; ativoNoDia: boolean }[];
}

/** Dia de uso do aluno (alocação) */
export interface DiaAlocado {
  diaSemana: number;
  rota: { id: string; nome: string };
  pontoEmbarque: { id: string; nome: string } | null;
}

/** GET /alunos/me/dias e /alunos/:id/dias */
export interface DiasDoAluno {
  statusConta: StatusConta;
  universidade: { id: string; nome: string };
  dias: DiaAlocado[];
  opcoes: {
    rota: { id: string; nome: string; instituicoes: string[] };
    horarioIda: string;
    horarioVolta: string | null;
    pontosEmbarque: { id: string; nome: string; endereco: string | null }[];
    /** ocupados/disponiveis não contam o próprio aluno */
    dias: { diaSemana: number; nome: string; capacidade: number; ocupados: number; disponiveis: number }[];
  }[];
}

export interface OcupacaoDia {
  diaSemana: number;
  nome: string;
  alocados: number;
  capacidade: number;
}

/** Programação semanal de uma rota (GET /programacoes) */
export interface Programacao {
  id: string;
  rotaId: string;
  onibusId: string;
  motoristaId: string;
  horarioIda: string;
  horarioVolta: string | null;
  diasSemana: number[];
  ativa: boolean;
  rota: { id: string; nome: string };
  onibus: { id: string; placa: string; capacidade: number; emManutencao: boolean };
  motorista: { id: string; usuario: { nome: string } };
  ocupacao: (OcupacaoDia & { disponiveis: number })[];
}

/** GET /dashboard/ocupacao-semanal */
export interface OcupacaoSemanal {
  dias: OcupacaoDia[];
  rotas: { rota: string; dias: OcupacaoDia[] }[];
}

export type CategoriaNotificacao = "GERAL" | "CADASTRO" | "DOCUMENTO" | "LEMBRETE" | "DIAS" | "FALTA" | "TRANSPORTE" | "LIBERACAO" | "ROTA";

export interface Notificacao {
  id: string;
  mensagem: string;
  categoria: CategoriaNotificacao;
  lida: boolean;
  criadoEm: string;
}

export type StatusConta = "PENDENTE" | "ATIVO" | "INATIVO";

/** Aluno como aparece nas listas do admin e nos dados do próprio aluno. */
export interface AlunoResumo {
  id: string;
  matricula: string | null;
  curso: string | null;
  telefone: string | null;
  statusConta: StatusConta;
  criadoEm: string;
  usuario: { id: string; nome: string; email: string };
  universidade: { id: string; nome: string };
}

export type StatusDocumento = "PENDENTE" | "EM_ANALISE" | "APROVADO" | "REPROVADO";
export type TipoDocumento = "DECLARACAO" | "COMPROVANTE" | "OUTRO";

/** Documento de matrícula (sem o caminho do arquivo; o arquivo abre por link temporário). */
export interface Documento {
  id: string;
  tipo: TipoDocumento;
  nomeOriginal: string;
  mimeType: string;
  tamanho: number;
  status: StatusDocumento;
  motivoReprovacao: string | null;
  analisadoEm: string | null;
  criadoEm: string;
  analisadoPor: { nome: string } | null;
}

/** GET /documentos (admin) */
export interface FilaDocumentos {
  itens: (Documento & {
    aluno: { id: string; matricula: string | null; statusConta: StatusConta; usuario: { nome: string }; universidade: { nome: string } };
  })[];
  total: number;
  pagina: number;
  porPagina: number;
  contagens: Record<StatusDocumento, number>;
}

export type StatusFalta = "REGISTRADA" | "JUSTIFICADA" | "INDEFERIDA";
/** Situação para as telas: REGISTRADA se divide em "sem justificativa" e "aguardando decisão" */
export type SituacaoFalta = "SEM_JUSTIFICATIVA" | "AGUARDANDO_DECISAO" | "JUSTIFICADA" | "INDEFERIDA";
export type MotivoAusencia = "DOENCA" | "COMPROMISSO_ACADEMICO" | "COMPROMISSO_PESSOAL" | "TRABALHO" | "TRANSPORTE_PROPRIO" | "OUTRO" | "FALTOU_NA_IDA";

export interface ViagemResumida {
  id: string;
  data: string;
  horario: string;
  sentido: SentidoViagem;
  rota: { nome: string };
}

export interface Falta {
  id: string;
  status: StatusFalta;
  prazoJustificativa: string;
  justificativa: string | null;
  justificadaEm: string | null;
  anexoNome: string | null;
  anexoMimeType: string | null;
  anexoTamanho: number | null;
  decididoEm: string | null;
  observacaoDecisao: string | null;
  criadoEm: string;
  decididoPor: { nome: string } | null;
  viagem: ViagemResumida;
}

export interface AusenciaAvisada {
  id: string;
  motivoAusencia: MotivoAusencia;
  canceladoEm: string | null;
  viagem: ViagemResumida;
}

/** GET /faltas/me */
export interface HistoricoFaltas {
  faltas: Falta[];
  ausenciasAvisadas: AusenciaAvisada[];
}

/** GET /faltas (admin) */
export interface FilaFaltas {
  itens: (Falta & { aluno: { id: string; matricula: string | null; usuario: { nome: string }; universidade: { nome: string } } })[];
  total: number;
  pagina: number;
  porPagina: number;
  contagens: Record<SituacaoFalta, number>;
}

/** GET /alunos/me */
export interface MeusDados extends AlunoResumo {
  pendencias: string[];
  /** Último documento enviado */
  documento: { id: string; status: StatusDocumento; motivoReprovacao: string | null; criadoEm: string } | null;
}

export interface EventoAuditoria {
  id: string;
  acao: string;
  detalhes: Record<string, unknown> | null;
  valorAnterior: Record<string, unknown> | null;
  valorNovo: Record<string, unknown> | null;
  criadoEm: string;
  usuario: { nome: string; papel: Papel } | null;
}

/** GET /alunos/:id (admin) */
export interface PerfilAlunoAdmin extends AlunoResumo {
  dias: DiaAlocado[];
  documentos: Documento[];
  faltas: Falta[];
  ausenciasAvisadas: AusenciaAvisada[];
  historico: EventoAuditoria[];
}

/** GET /alunos (admin) */
export interface ListaAlunos {
  itens: AlunoResumo[];
  total: number;
  pagina: number;
  porPagina: number;
  contagens: Record<StatusConta, number>;
  /** Alunos com documento aguardando análise (com a mesma busca) */
  documentosPendentes: number;
}

/** Resposta de GET /dashboard/relatorio */
export interface Relatorio {
  periodo: { inicio: string; fim: string; dias: number };
  totais: { viagens: number; confirmados: number; embarcados: number; faltas: number; pendentes: number; taxaPresenca: number | null };
  porDia: { dia: string; viagens: number; confirmados: number; embarcados: number; faltas: number }[];
  faltasPorUniversidade: Record<string, number>;
  viagens: { id: string; dia: string; horario: string; rota: string; placa: string; status: StatusViagem; confirmados: number; embarcados: number; faltas: number }[];
  faltas: {
    faltaId: string;
    alunoId: string;
    viagemId: string;
    dia: string;
    horario: string;
    rota: string;
    aluno: string;
    universidade: string;
    situacao: SituacaoFalta;
  }[];
}
