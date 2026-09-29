import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../errors/AppError";
import { gerarRefreshToken as gerarTokenAleatorio, hashToken } from "../../utils/jwt";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { posicaoRecente } from "../gps/localizacao.service";

/**
 * Embarque pelo QR do motorista.
 *
 * O QR NÃO é uma identidade fixa do motorista: ao iniciar a viagem o motorista
 * gera uma sessão de embarque (vinculada a viagem, motorista e ônibus) com um
 * token aleatório e validade. O aluno escaneia; o backend valida a sessão e
 * identifica o aluno pelo próprio login — nunca por um id enviado pelo app.
 */

/** Conteúdo do QR: prefixo de versão + viagem + token. */
const PREFIXO_QR = "BUSON1";

export function montarConteudoQr(viagemId: string, token: string) {
  return `${PREFIXO_QR}.${viagemId}.${token}`;
}

async function viagemDoMotorista(tx: Prisma.TransactionClient, viagemId: string, motoristaId: string) {
  const viagem = await tx.viagem.findUnique({ where: { id: viagemId } });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");
  if (viagem.motoristaId !== motoristaId) throw new AppError("VIAGEM_DE_OUTRO_MOTORISTA");
  if (viagem.status === "ENCERRADA") throw new AppError("VIAGEM_ENCERRADA");
  if (viagem.status !== "EM_ANDAMENTO") throw new AppError("VIAGEM_NAO_INICIADA");
  return viagem;
}

/** Gera (ou renova) o QR da viagem. Renovar invalida o QR anterior na hora. */
export async function gerarSessao(viagemId: string, motoristaId: string) {
  return prisma.$transaction(async (tx) => {
    const viagem = await viagemDoMotorista(tx, viagemId, motoristaId);
    await tx.boardingSession.updateMany({ where: { viagemId, ativa: true }, data: { ativa: false } });

    const { token, hash } = gerarTokenAleatorio();
    const expiraEm = new Date(Date.now() + env.qrEmbarqueMinutos * 60_000);
    const sessao = await tx.boardingSession.create({
      data: { viagemId, motoristaId, onibusId: viagem.onibusId, tokenHash: hash, expiraEm },
    });
    return { sessaoId: sessao.id, conteudoQr: montarConteudoQr(viagemId, token), expiraEm };
  });
}

/** Encerra os QRs da viagem (ao encerrar a viagem). */
export async function encerrarSessoes(db: Prisma.TransactionClient | typeof prisma, viagemId: string) {
  await db.boardingSession.updateMany({ where: { viagemId, ativa: true }, data: { ativa: false } });
}

/**
 * O aluno autenticado escaneia o QR do motorista. Validações (na ordem):
 * perfil de aluno ativo → viagem existe → viagem em andamento → QR desta viagem
 * e ativo → QR não expirado → instituição do aluno na rota → vaga confirmada →
 * ainda não embarcou.
 */
export async function escanear(viagemId: string, usuarioId: string, token: string) {
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId } });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  if (aluno.statusConta === "INATIVO") throw new AppError("CONTA_INATIVA");

  const viagem = await prisma.viagem.findUnique({
    where: { id: viagemId },
    include: { rota: { include: { pontos: true } }, onibus: { select: { placa: true } } },
  });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");
  if (viagem.status === "ENCERRADA") throw new AppError("VIAGEM_ENCERRADA");
  if (viagem.status !== "EM_ANDAMENTO") throw new AppError("VIAGEM_NAO_INICIADA");

  const sessao = await prisma.boardingSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!sessao || sessao.viagemId !== viagemId || !sessao.ativa) throw new AppError("QR_INVALIDO");
  if (sessao.expiraEm < new Date()) throw new AppError("QR_EXPIRADO");

  if (!viagem.rota.pontos.some((p) => p.universidadeId === aluno.universidadeId)) throw new AppError("ROTA_INCOMPATIVEL");

  try {
    const embarque = await prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.findUnique({ where: { viagemId_alunoId: { viagemId, alunoId: aluno.id } } });
      // PROGRAMADO: alocado no dia que embarcou sem confirmar antes — a vaga já era dele
      if (!checkin || (checkin.status !== "CONFIRMADO" && checkin.status !== "PROGRAMADO")) throw new AppError("SEM_VAGA_CONFIRMADA");
      if (checkin.embarcado) throw new AppError("EMBARQUE_JA_CONFIRMADO");

      // Onde embarcou = última posição do ônibus (o aluno não precisa ligar o GPS)
      const onde = await posicaoRecente(tx, viagemId);
      const registro = await tx.embarque.create({
        data: { viagemId, alunoId: aluno.id, metodo: "QR_MOTORISTA", sessaoId: sessao.id, latitude: onde?.latitude, longitude: onde?.longitude },
      });
      await tx.checkin.update({ where: { id: checkin.id }, data: { embarcado: true, status: "CONFIRMADO" } });
      return registro;
    });
    return {
      id: embarque.id,
      metodo: embarque.metodo,
      dataHora: embarque.dataHora,
      viagem: { id: viagem.id, horario: viagem.horario, rota: viagem.rota.nome, onibus: viagem.onibus.placa },
    };
  } catch (err) {
    // Dois escaneamentos simultâneos: o banco (único por viagem+aluno) barra o segundo
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AppError("EMBARQUE_JA_CONFIRMADO");
    throw err;
  }
}

/** Embarque manual pelo motorista (aluno sem celular, câmera com defeito etc.). Fica auditado. */
export async function registrarManual(viagemId: string, motoristaId: string, motoristaUsuarioId: string, alunoId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      await viagemDoMotorista(tx, viagemId, motoristaId);
      const checkin = await tx.checkin.findUnique({
        where: { viagemId_alunoId: { viagemId, alunoId } },
        include: { aluno: { include: { usuario: { select: { nome: true } }, universidade: { select: { nome: true } } } } },
      });
      // PROGRAMADO: alocado no dia que embarcou sem confirmar antes — a vaga já era dele
      if (!checkin || (checkin.status !== "CONFIRMADO" && checkin.status !== "PROGRAMADO")) throw new AppError("SEM_VAGA_CONFIRMADA");
      if (checkin.embarcado) throw new AppError("EMBARQUE_JA_CONFIRMADO");

      const onde = await posicaoRecente(tx, viagemId);
      const embarque = await tx.embarque.create({
        data: { viagemId, alunoId, metodo: "MANUAL", registradoPorId: motoristaUsuarioId, latitude: onde?.latitude, longitude: onde?.longitude },
      });
      await tx.checkin.update({ where: { id: checkin.id }, data: { embarcado: true, status: "CONFIRMADO" } });
      await registrarAuditoria(tx, {
        usuarioId: motoristaUsuarioId,
        acao: "EMBARQUE_MANUAL",
        entidade: "Viagem",
        entidadeId: viagemId,
        valorNovo: { alunoId, aluno: checkin.aluno.usuario.nome },
      });
      return {
        id: embarque.id,
        metodo: embarque.metodo,
        dataHora: embarque.dataHora,
        aluno: { nome: checkin.aluno.usuario.nome, universidade: checkin.aluno.universidade.nome },
      };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AppError("EMBARQUE_JA_CONFIRMADO");
    throw err;
  }
}
