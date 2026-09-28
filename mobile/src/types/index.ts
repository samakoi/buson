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
    qrCode: string;
    universidade: { id: string; nome: string };
    statusConta: StatusConta;
  } | null;
}

export type StatusCheckin = "CONFIRMADO" | "ESPERA" | "CANCELADO";
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

export interface Rota {
  id: string;
  nome: string;
  pontos: { id: string; ordem: number; universidade: Universidade }[];
}

export interface Motorista {
  id: string;
  onibusId: string | null;
  usuario: { id: string; nome: string; email: string };
  onibus: { id: string; placa: string } | null;
}

export interface ResumoViagem {
  confirmados: number;
  embarcados: number;
  espera: number;
}

export interface Viagem {
  id: string;
  data: string;
  horario: string;
  vagas: number;
  status: StatusViagem;
  latitude?: number;
  longitude?: number;
  rota: { nome: string };
  onibus: Onibus;
  motorista?: { usuario: { nome: string } };
  resumo: ResumoViagem;
  /** Só vem para o aluno */
  vagasRestantes?: number;
  /** Só vem para o aluno: o check-in dele nesta viagem */
  meuCheckin?: { status: StatusCheckin; embarcado: boolean; posicaoFila: number | null } | null;
}

export interface Checkin {
  id: string;
  alunoId: string;
  status: StatusCheckin;
  embarcado: boolean;
  aluno: {
    qrCode: string;
    universidade: { nome: string };
    usuario: { nome: string };
  };
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

/** GET /alunos/me */
export interface MeusDados extends AlunoResumo {
  pendencias: string[];
}

export interface EventoAuditoria {
  id: string;
  acao: string;
  detalhes: Record<string, unknown> | null;
  criadoEm: string;
  usuario: { nome: string; papel: Papel } | null;
}

/** GET /alunos/:id (admin) */
export interface PerfilAlunoAdmin extends AlunoResumo {
  historico: EventoAuditoria[];
}

/** GET /alunos (admin) */
export interface ListaAlunos {
  itens: AlunoResumo[];
  total: number;
  pagina: number;
  porPagina: number;
  contagens: Record<StatusConta, number>;
}

/** Resposta de GET /dashboard/relatorio */
export interface Relatorio {
  periodo: { inicio: string; fim: string; dias: number };
  totais: { viagens: number; confirmados: number; embarcados: number; faltas: number; pendentes: number; taxaPresenca: number | null };
  porDia: { dia: string; viagens: number; confirmados: number; embarcados: number; faltas: number }[];
  faltasPorUniversidade: Record<string, number>;
  viagens: { id: string; dia: string; horario: string; rota: string; placa: string; status: StatusViagem; confirmados: number; embarcados: number; faltas: number }[];
  faltas: { viagemId: string; dia: string; horario: string; rota: string; aluno: string; universidade: string }[];
}
