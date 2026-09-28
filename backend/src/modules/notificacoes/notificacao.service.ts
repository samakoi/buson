import { CategoriaNotificacao, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export interface NovaNotificacao {
  mensagem: string;
  categoria?: CategoriaNotificacao;
}

/** Cria avisos para usuários (qualquer perfil). O envio por push é feito a partir destes registros. */
export async function notificarUsuarios(db: Db, usuarioIds: string[], n: NovaNotificacao) {
  const unicos = [...new Set(usuarioIds)];
  if (unicos.length === 0) return;
  await db.notificacao.createMany({
    data: unicos.map((usuarioId) => ({ usuarioId, mensagem: n.mensagem, categoria: n.categoria ?? "GERAL" })),
  });
}

export async function notificarUsuario(db: Db, usuarioId: string, n: NovaNotificacao) {
  await notificarUsuarios(db, [usuarioId], n);
}

/** Atalho para quem só tem o id do aluno (a maior parte das regras de transporte). */
export async function notificarAlunos(db: Db, alunoIds: string[], n: NovaNotificacao) {
  const unicos = [...new Set(alunoIds)];
  if (unicos.length === 0) return;
  const alunos = await db.aluno.findMany({ where: { id: { in: unicos } }, select: { usuarioId: true } });
  await notificarUsuarios(db, alunos.map((a) => a.usuarioId), n);
}

export async function notificarAluno(db: Db, alunoId: string, n: NovaNotificacao) {
  await notificarAlunos(db, [alunoId], n);
}

export async function notificarAdmins(db: Db, n: NovaNotificacao) {
  const admins = await db.usuario.findMany({ where: { papel: "ADMIN" }, select: { id: true } });
  await notificarUsuarios(db, admins.map((a) => a.id), n);
}

export async function listar(usuarioId: string) {
  const [itens, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: { id: true, mensagem: true, categoria: true, lida: true, criadoEm: true },
    }),
    prisma.notificacao.count({ where: { usuarioId, lida: false } }),
  ]);
  return { itens, naoLidas };
}

export async function marcarTodasComoLidas(usuarioId: string) {
  await prisma.notificacao.updateMany({ where: { usuarioId, lida: false }, data: { lida: true } });
  return { ok: true };
}
