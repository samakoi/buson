import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";
import { hashPassword, comparePassword } from "../../utils/password";
import { gerarRefreshToken, hashToken, signAccessToken } from "../../utils/jwt";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { desativarDoAparelho, desativarTodos } from "../push/push.service";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { notificarAdmins } from "../notificacoes/notificacao.service";

interface CadastroAlunoInput {
  nome: string;
  email: string;
  senha: string;
  universidadeId: string;
}

export async function cadastrarAluno(input: CadastroAlunoInput) {
  const existente = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existente) throw new AppError("EMAIL_JA_CADASTRADO");

  const senhaHash = await hashPassword(input.senha);

  // Novo aluno entra PENDENTE até a matrícula ser validada pelo admin
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        nome: input.nome,
        email: input.email,
        senhaHash,
        papel: "ALUNO",
        aluno: {
          create: { universidadeId: input.universidadeId },
        },
      },
      include: { aluno: { include: { universidade: true } } },
    });
    await registrarAuditoria(tx, {
      usuarioId: usuario.id,
      acao: "ALUNO_CADASTRADO",
      entidade: "Aluno",
      entidadeId: usuario.aluno!.id,
    });
    await notificarAdmins(tx, {
      mensagem: `Novo aluno cadastrado: ${usuario.nome} (${usuario.aluno!.universidade.nome}).`,
      categoria: "CADASTRO",
    });
    return usuario;
  });
}

export async function perfil(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      aluno: { select: { id: true, statusConta: true, universidade: { select: { id: true, nome: true } } } },
    },
  });
  if (!usuario) throw new AppError("USUARIO_NAO_ENCONTRADO");
  return usuario;
}

/** Dados do dispositivo que abriu a sessão (para listar e encerrar sessões). */
export interface ContextoSessao {
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

// Hash usado quando o e-mail não existe: o tempo de resposta fica igual ao de uma senha errada
const HASH_FICTICIO = bcrypt.hashSync("usuario-inexistente", 10);

async function criarSessao(db: Pick<typeof prisma, "refreshToken">, usuarioId: string, ctx: ContextoSessao) {
  const { token, hash } = gerarRefreshToken();
  const expiraEm = new Date(Date.now() + env.refreshTokenDias * 86_400_000);
  const sessao = await db.refreshToken.create({
    data: {
      usuarioId,
      tokenHash: hash,
      deviceId: ctx.deviceId?.slice(0, 100),
      ip: ctx.ip?.slice(0, 64),
      userAgent: ctx.userAgent?.slice(0, 255),
      expiraEm,
    },
  });
  return { token, sessao };
}

export async function login(email: string, senha: string, ctx: ContextoSessao = {}) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const senhaConfere = await comparePassword(senha, usuario?.senhaHash ?? HASH_FICTICIO);
  if (!usuario || !senhaConfere) throw new AppError("CREDENCIAIS_INVALIDAS");

  const { token } = await criarSessao(prisma, usuario.id, ctx);
  return {
    accessToken: signAccessToken({ sub: usuario.id, papel: usuario.papel }),
    refreshToken: token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  };
}

/** Reuso de um token já rotacionado (sinal de roubo): encerra a família de sessões do dispositivo. */
async function derrubarSessoesDoDispositivo(usuarioId: string, deviceId: string | null) {
  await prisma.refreshToken.updateMany({
    where: { usuarioId, deviceId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  await desativarDoAparelho(usuarioId, deviceId, "Sessão encerrada por segurança");
}

/**
 * Troca o refresh token por um novo par (rotação). Se um token já trocado for
 * reapresentado — sinal de roubo —, todas as sessões daquele dispositivo caem.
 */
export async function renovar(refreshToken: string, ctx: ContextoSessao = {}) {
  const atual = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { usuario: { select: { id: true, papel: true } } },
  });
  if (!atual) throw new AppError("REFRESH_INVALIDO");

  if (atual.revogadoEm) {
    // Fora de transação de propósito: a revogação precisa persistir mesmo com o erro abaixo
    if (atual.substituidoPorId) await derrubarSessoesDoDispositivo(atual.usuarioId, atual.deviceId);
    throw new AppError("SESSAO_REVOGADA");
  }
  if (atual.expiraEm < new Date()) throw new AppError("REFRESH_INVALIDO");

  const novo = await prisma.$transaction(async (tx) => {
    const { token, sessao } = await criarSessao(tx, atual.usuarioId, {
      deviceId: atual.deviceId ?? ctx.deviceId,
      ip: ctx.ip,
      userAgent: ctx.userAgent ?? atual.userAgent ?? undefined,
    });
    // Troca atômica: só revoga se ainda estiver ativo. Se outra renovação com o
    // mesmo token chegou antes, count = 0 e esta é tratada como reuso.
    const { count } = await tx.refreshToken.updateMany({
      where: { id: atual.id, revogadoEm: null },
      data: { revogadoEm: new Date(), substituidoPorId: sessao.id, ultimoUsoEm: new Date() },
    });
    if (count === 0) {
      await tx.refreshToken.delete({ where: { id: sessao.id } });
      return null;
    }
    return token;
  });

  if (!novo) {
    await derrubarSessoesDoDispositivo(atual.usuarioId, atual.deviceId);
    throw new AppError("SESSAO_REVOGADA");
  }
  return {
    accessToken: signAccessToken({ sub: atual.usuario.id, papel: atual.usuario.papel }),
    refreshToken: novo,
  };
}

/** Sair deste dispositivo: revoga a sessão do refresh token informado. */
export async function logout(refreshToken: string) {
  const sessao = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, select: { usuarioId: true, deviceId: true } });
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  // Saiu do aparelho: ele para de receber push
  if (sessao) await desativarDoAparelho(sessao.usuarioId, sessao.deviceId, "Saiu do aparelho");
}

/** Sair de todos os dispositivos. */
export async function logoutTodos(usuarioId: string) {
  const { count } = await prisma.refreshToken.updateMany({
    where: { usuarioId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  await desativarTodos(usuarioId, "Saiu de todos os aparelhos");
  return { sessoesEncerradas: count };
}

export async function listarSessoes(usuarioId: string) {
  return prisma.refreshToken.findMany({
    where: { usuarioId, revogadoEm: null, expiraEm: { gt: new Date() } },
    select: { id: true, deviceId: true, ip: true, userAgent: true, criadoEm: true, ultimoUsoEm: true },
    orderBy: { ultimoUsoEm: "desc" },
  });
}

/** Encerrar a sessão de um dispositivo específico (tela "Aparelhos conectados"). */
export async function revogarSessao(usuarioId: string, sessaoId: string) {
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: sessaoId, usuarioId, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
  if (count === 0) throw new AppError("SESSAO_NAO_ENCONTRADA");
  const sessao = await prisma.refreshToken.findUniqueOrThrow({ where: { id: sessaoId }, select: { deviceId: true } });
  await desativarDoAparelho(usuarioId, sessao.deviceId, "Sessão encerrada em outro aparelho");
}
