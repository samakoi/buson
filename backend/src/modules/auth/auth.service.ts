import { prisma } from "../../config/prisma";
import { hashPassword, comparePassword } from "../../utils/password";
import { signAccessToken, signRefreshToken } from "../../utils/jwt";
import { AppError } from "../../middlewares/errorHandler";
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
  if (existente) throw new AppError("Este e-mail já está cadastrado.", 409);

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
      aluno: { select: { id: true, qrCode: true, statusConta: true, universidade: { select: { id: true, nome: true } } } },
    },
  });
  if (!usuario) throw new AppError("Usuário não encontrado.", 404);
  return usuario;
}

export async function login(email: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new AppError("E-mail ou senha inválidos.", 401);

  const senhaConfere = await comparePassword(senha, usuario.senhaHash);
  if (!senhaConfere) throw new AppError("E-mail ou senha inválidos.", 401);

  const payload = { sub: usuario.id, papel: usuario.papel };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  };
}
