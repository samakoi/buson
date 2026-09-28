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
}

/** Regra 10 — registra alterações importantes para auditoria posterior. */
export async function registrarAuditoria(db: Db, r: RegistroAuditoria) {
  await db.auditoria.create({
    data: { usuarioId: r.usuarioId ?? null, acao: r.acao, entidade: r.entidade, entidadeId: r.entidadeId, detalhes: r.detalhes },
  });
}

export async function historico(entidade: string, entidadeId: string, limite = 30) {
  return prisma.auditoria.findMany({
    where: { entidade, entidadeId },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: { id: true, acao: true, detalhes: true, criadoEm: true, usuario: { select: { nome: true, papel: true } } },
  });
}
