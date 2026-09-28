import { Papel } from "@prisma/client";

/**
 * Permissões por ação. As rotas exigem permissões (não papéis), então novos
 * papéis só precisam de uma entrada neste mapa — sem mexer nas rotas.
 */
export type Permissao =
  | "aluno:proprio" // dados, dias, documentos do próprio aluno
  | "checkin:fazer"
  | "embarque:escanear" // aluno escaneia o QR do motorista
  | "viagem:atual" // ver a viagem do dia
  | "viagem:passageiros"
  | "viagem:operar" // iniciar, encerrar, embarque manual, localização
  | "viagens:gerenciar" // criar/excluir viagens
  | "alunos:ler"
  | "alunos:gerenciar" // ativar/inativar, aprovar documentos
  | "motoristas:gerenciar"
  | "frota:gerenciar"
  | "rotas:gerenciar"
  | "instituicoes:gerenciar"
  | "dashboard:ler";

/** Papéis existentes no banco + papéis previstos (ainda não usados). */
export type PapelComPrevistos = Papel | "SUPER_ADMIN" | "GESTOR" | "OPERADOR";

const ADMINISTRACAO: Permissao[] = [
  "viagem:passageiros",
  "viagens:gerenciar",
  "alunos:ler",
  "alunos:gerenciar",
  "motoristas:gerenciar",
  "frota:gerenciar",
  "rotas:gerenciar",
  "instituicoes:gerenciar",
  "dashboard:ler",
];

export const PERMISSOES_POR_PAPEL: Record<PapelComPrevistos, readonly Permissao[]> = {
  ALUNO: ["aluno:proprio", "checkin:fazer", "embarque:escanear", "viagem:atual"],
  MOTORISTA: ["viagem:atual", "viagem:passageiros", "viagem:operar"],
  ADMIN: ADMINISTRACAO,
  // Previstos para a operação em escala (Secretarias, empresas de transporte):
  SUPER_ADMIN: ADMINISTRACAO,
  GESTOR: ["viagem:passageiros", "alunos:ler", "dashboard:ler"],
  OPERADOR: ["viagem:passageiros", "viagens:gerenciar", "alunos:ler"],
};

export function temPermissao(papel: PapelComPrevistos, permissao: Permissao) {
  return PERMISSOES_POR_PAPEL[papel]?.includes(permissao) ?? false;
}
