import { Prisma } from "@prisma/client";
import { intervaloDeDias } from "../../utils/datas";
import { notificarAluno } from "../notificacoes/notificacao.service";

/** Regras de vaga compartilhadas por viagens, alocação, programação e faltas. */

type Tx = Prisma.TransactionClient;

/** Status que ocupam uma vaga no ônibus. */
export const OCUPA_VAGA = ["PROGRAMADO", "CONFIRMADO"] as const;

/** Trava várias viagens sempre na mesma ordem (por id), para não haver deadlock. */
export async function travarViagens(tx: Tx, viagemIds: string[]) {
  const ids = [...new Set(viagemIds)].sort();
  if (ids.length > 0) await tx.$queryRaw`SELECT id FROM viagens WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
}

export async function contarOcupados(tx: Tx, viagemId: string) {
  return tx.checkin.count({ where: { viagemId, status: { in: [...OCUPA_VAGA] } } });
}

/** Regra 3.2 — Lista de espera inteligente: uma vaga abriu, o primeiro da fila é confirmado. */
export async function promoverProximoDaEspera(tx: Tx, viagemId: string) {
  const proximo = await tx.checkin.findFirst({
    where: { viagemId, status: "ESPERA" },
    orderBy: { criadoEm: "asc" },
  });
  if (!proximo) return;
  await tx.checkin.update({ where: { id: proximo.id }, data: { status: "CONFIRMADO" } });
  await notificarAluno(tx, proximo.alunoId, { mensagem: "Boas notícias! Sua vaga foi confirmada automaticamente.", categoria: "TRANSPORTE" });
}

/** A outra viagem (ida ↔ volta) da mesma programação no mesmo dia, se ainda não começou. */
export async function viagemIrma(tx: Tx, viagemId: string) {
  const base = await tx.viagem.findUnique({ where: { id: viagemId }, select: { programacaoId: true, sentido: true, data: true } });
  if (!base?.programacaoId) return null;
  return tx.viagem.findFirst({
    where: {
      programacaoId: base.programacaoId,
      sentido: base.sentido === "IDA" ? "VOLTA" : "IDA",
      data: intervaloDeDias(base.data),
      status: "AGUARDANDO",
    },
    select: { id: true },
  });
}
