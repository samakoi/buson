import type { NomeIcone } from "../components/icones";
import type { Tom } from "../theme/tokens";
import type { CategoriaNotificacao, Falta, MotivoAusencia, SituacaoFalta, StatusConta, StatusDocumento, StatusViagem } from "../types";

/** Rótulos únicos de status — use sempre estes em vez de escrever o texto na tela. */
export const statusViagem: Record<StatusViagem, { rotulo: string; tom: Tom; icone: NomeIcone }> = {
  AGUARDANDO: { rotulo: "Aguardando saída", tom: "info", icone: "time-outline" },
  EM_ANDAMENTO: { rotulo: "Em andamento", tom: "sucesso", icone: "navigate" },
  ENCERRADA: { rotulo: "Encerrada", tom: "neutro", icone: "flag-outline" },
};

export const nomePapel = { ALUNO: "Aluno", MOTORISTA: "Motorista", ADMIN: "Administrador" } as const;

export const statusManutencao = (emManutencao: boolean): { rotulo: string; tom: Tom; icone: NomeIcone } =>
  emManutencao
    ? { rotulo: "Em manutenção", tom: "alerta", icone: "construct" }
    : { rotulo: "Em operação", tom: "sucesso", icone: "checkmark-circle" };

/** `rotulo` concorda com "aluno"; `conta` concorda com "conta" (feminino). */
export const statusConta: Record<StatusConta, { rotulo: string; conta: string; tom: Tom; icone: NomeIcone }> = {
  PENDENTE: { rotulo: "Pendente", conta: "Conta pendente", tom: "alerta", icone: "hourglass-outline" },
  ATIVO: { rotulo: "Ativo", conta: "Conta ativa", tom: "sucesso", icone: "checkmark-circle" },
  INATIVO: { rotulo: "Inativo", conta: "Conta inativa", tom: "neutro", icone: "pause-circle-outline" },
};

export const statusDocumento: Record<StatusDocumento, { rotulo: string; tom: Tom; icone: NomeIcone }> = {
  PENDENTE: { rotulo: "Aguardando análise", tom: "alerta", icone: "hourglass-outline" },
  EM_ANALISE: { rotulo: "Em análise", tom: "info", icone: "eye-outline" },
  APROVADO: { rotulo: "Aprovado", tom: "sucesso", icone: "checkmark-circle" },
  REPROVADO: { rotulo: "Reprovado", tom: "perigo", icone: "close-circle" },
};

export const tipoDocumento = { DECLARACAO: "Declaração de matrícula", COMPROVANTE: "Comprovante de matrícula", OUTRO: "Outro documento" } as const;

export const situacaoFalta: Record<SituacaoFalta, { rotulo: string; tom: Tom; icone: NomeIcone }> = {
  SEM_JUSTIFICATIVA: { rotulo: "Sem justificativa", tom: "perigo", icone: "alert-circle-outline" },
  AGUARDANDO_DECISAO: { rotulo: "Justificativa em análise", tom: "alerta", icone: "hourglass-outline" },
  JUSTIFICADA: { rotulo: "Justificada", tom: "sucesso", icone: "checkmark-circle" },
  INDEFERIDA: { rotulo: "Indeferida", tom: "neutro", icone: "close-circle-outline" },
};

/** A situação que a tela mostra a partir do status da falta. */
export function situacaoDaFalta(f: Pick<Falta, "status" | "justificativa">): SituacaoFalta {
  if (f.status !== "REGISTRADA") return f.status;
  return f.justificativa ? "AGUARDANDO_DECISAO" : "SEM_JUSTIFICATIVA";
}

export const motivoAusencia: Record<MotivoAusencia, string> = {
  DOENCA: "Doença",
  COMPROMISSO_ACADEMICO: "Compromisso acadêmico",
  COMPROMISSO_PESSOAL: "Compromisso pessoal",
  TRABALHO: "Trabalho",
  TRANSPORTE_PROPRIO: "Vou por conta própria",
  OUTRO: "Outro motivo",
  FALTOU_NA_IDA: "Vaga liberada: faltou na ida",
};

/** Converte valores gravados na auditoria (ex.: "ATIVO") no texto da tela. */
export function rotuloValorAuditoria(valor: unknown): string {
  if (typeof valor !== "string") return String(valor ?? "");
  if (valor in statusConta) return statusConta[valor as StatusConta].rotulo;
  if (valor in statusDocumento) return statusDocumento[valor as StatusDocumento].rotulo;
  if (valor === "REGISTRADA") return "Registrada";
  if (valor in situacaoFalta) return situacaoFalta[valor as SituacaoFalta].rotulo;
  return valor;
}

export const categoriaAviso: Record<CategoriaNotificacao, { icone: NomeIcone; tom: Tom }> = {
  GERAL: { icone: "notifications-outline", tom: "info" },
  CADASTRO: { icone: "person-circle-outline", tom: "info" },
  DOCUMENTO: { icone: "document-text-outline", tom: "info" },
  LEMBRETE: { icone: "alarm-outline", tom: "info" },
  DIAS: { icone: "calendar-outline", tom: "info" },
  FALTA: { icone: "alert-circle-outline", tom: "perigo" },
  TRANSPORTE: { icone: "bus-outline", tom: "info" },
  LIBERACAO: { icone: "school-outline", tom: "sucesso" },
  ROTA: { icone: "navigate-outline", tom: "info" },
  VIAGEM: { icone: "warning-outline", tom: "alerta" },
};

/** Texto legível das ações registradas na auditoria. */
export const acaoAuditoria: Record<string, string> = {
  ALUNO_CADASTRADO: "Cadastro criado",
  STATUS_CONTA_ALTERADO: "Status da conta alterado",
  UNIVERSIDADE_ALTERADA: "Universidade alterada",
  DIAS_ALTERADOS: "Dias de uso alterados",
  DIAS_REMOVIDOS_PELO_SISTEMA: "Dias liberados automaticamente",
  DOCUMENTO_ENVIADO: "Documento enviado",
  DOCUMENTO_EM_ANALISE: "Documento em análise",
  DOCUMENTO_APROVADO: "Documento aprovado",
  DOCUMENTO_REPROVADO: "Documento reprovado",
  FALTA_JUSTIFICATIVA_ENVIADA: "Justificativa de falta enviada",
  FALTA_JUSTIFICADA: "Falta justificada",
  FALTA_INDEFERIDA: "Justificativa de falta indeferida",
};

type DiaAuditado = { dia: string; rota?: string; ponto?: string | null };

/** Resumo legível do "antes → depois" de um registro da auditoria. */
export function mudancaAuditoria(h: { valorAnterior: Record<string, unknown> | null; valorNovo: Record<string, unknown> | null }): string {
  const antes = h.valorAnterior ?? {};
  const depois = h.valorNovo ?? {};
  if ("statusConta" in antes || "statusConta" in depois) {
    return `${rotuloValorAuditoria(antes.statusConta)} → ${rotuloValorAuditoria(depois.statusConta)}`;
  }
  if ("falta" in depois) {
    return `${rotuloValorAuditoria(antes.falta)} → ${rotuloValorAuditoria(depois.falta)}`;
  }
  if ("documento" in depois) {
    return "documento" in antes ? `${rotuloValorAuditoria(antes.documento)} → ${rotuloValorAuditoria(depois.documento)}` : rotuloValorAuditoria(depois.documento);
  }
  const dias = (v: unknown) => {
    if (!Array.isArray(v)) return null;
    const lista = v.map((d) => (typeof d === "string" ? d : (d as DiaAuditado).dia));
    return lista.length ? lista.join(", ") : "nenhum";
  };
  if ("dias" in antes || "dias" in depois) {
    const a = dias(antes.dias);
    const d = dias(depois.dias);
    if (a && d) return `${a} → ${d}`;
    if (a) return `${a}${typeof antes.rota === "string" ? ` (${antes.rota})` : ""}`;
    return d ?? "";
  }
  return "";
}
