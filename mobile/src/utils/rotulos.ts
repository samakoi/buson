import type { NomeIcone } from "../components/icones";
import type { Tom } from "../theme/tokens";
import type { CategoriaNotificacao, StatusConta, StatusViagem } from "../types";

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

/** Converte valores gravados na auditoria (ex.: "ATIVO") no texto da tela. */
export function rotuloValorAuditoria(valor: unknown): string {
  if (typeof valor !== "string") return String(valor ?? "");
  return valor in statusConta ? statusConta[valor as StatusConta].rotulo : valor;
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
};

/** Texto legível das ações registradas na auditoria. */
export const acaoAuditoria: Record<string, string> = {
  ALUNO_CADASTRADO: "Cadastro criado",
  STATUS_CONTA_ALTERADO: "Status da conta alterado",
  UNIVERSIDADE_ALTERADA: "Universidade alterada",
};
