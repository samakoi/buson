import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export interface RegistroAuditoria {
  /** Quem fez a ação; omitido = sistema (agendador, regras automáticas). */
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId: string;
  detalhes?: Prisma.InputJsonValue;
  /** Estado antes da mudança (só os campos relevantes) */
  valorAnterior?: Prisma.InputJsonValue | null;
  /** Estado depois da mudança */
  valorNovo?: Prisma.InputJsonValue | null;
}

/** Regra 10 — registra alterações importantes com autor, antes e depois. */
export async function registrarAuditoria(db: Db, r: RegistroAuditoria) {
  await db.auditoria.create({
    data: {
      usuarioId: r.usuarioId ?? null,
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      detalhes: r.detalhes,
      valorAnterior: r.valorAnterior ?? undefined,
      valorNovo: r.valorNovo ?? undefined,
    },
  });
}

/** Só os campos que mudaram, para a auditoria não repetir o registro inteiro. */
export function diferenca<T extends Record<string, unknown>>(antes: T, depois: Partial<T>) {
  const anterior: Record<string, unknown> = {};
  const novo: Record<string, unknown> = {};
  for (const chave of Object.keys(depois)) {
    if (depois[chave] !== undefined && JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave])) {
      anterior[chave] = antes[chave] ?? null;
      novo[chave] = depois[chave] ?? null;
    }
  }
  return { valorAnterior: anterior as Prisma.InputJsonValue, valorNovo: novo as Prisma.InputJsonValue, mudou: Object.keys(novo).length > 0 };
}

export async function historico(entidade: string, entidadeId: string, limite = 30) {
  return prisma.auditoria.findMany({
    where: { entidade, entidadeId },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: {
      id: true,
      acao: true,
      detalhes: true,
      valorAnterior: true,
      valorNovo: true,
      criadoEm: true,
      usuario: { select: { nome: true, papel: true } },
    },
  });
}
