import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { temPermissao } from "../../auth/permissoes";
import { JwtPayload } from "../../utils/jwt";
import { diaMes, intervaloDeDias, parseDia, somarDias } from "../../utils/datas";
import { assinarLink, verificarLink } from "../../utils/linkAssinado";
import { armazenamento } from "../../storage/armazenamento";
import { detectarFormato, nomeSeguro } from "../../storage/formatos";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { notificarAdmins, notificarAluno } from "../notificacoes/notificacao.service";
import { OCUPA_VAGA, promoverProximoDaEspera, travarViagens, viagemIrma } from "../viagens/vagas";

/**
 * Faltas (Fase 4):
 *  - Registradas ao encerrar a viagem: aluno com vaga (confirmado ou programado) que não embarcou.
 *  - Falta na IDA libera a vaga da VOLTA do mesmo dia (conta 1 falta só).
 *  - Avisar antes da saída NÃO é falta (vira "ausência avisada" no check-in).
 *  - O aluno justifica em até 7 dias (texto + anexo opcional); depois, só a administração.
 *  - A administração justifica ou indefere (motivo obrigatório). Tudo auditado e avisado.
 *  - 3 faltas sem justificativa em 30 dias → alerta para a administração (sem punição automática).
 */

type Tx = Prisma.TransactionClient;

export const PRAZO_JUSTIFICATIVA_DIAS = 7;
const LIMITE_ALERTA = 3;
const JANELA_ALERTA_DIAS = 30;

/** O que as telas veem de uma falta (sem o caminho do anexo). */
export const faltaPublica = {
  id: true,
  status: true,
  prazoJustificativa: true,
  justificativa: true,
  justificadaEm: true,
  anexoNome: true,
  anexoMimeType: true,
  anexoTamanho: true,
  decididoEm: true,
  observacaoDecisao: true,
  criadoEm: true,
  decididoPor: { select: { nome: true } },
  viagem: { select: { id: true, data: true, horario: true, sentido: true, rota: { select: { nome: true } } } },
} satisfies Prisma.FaltaSelect;

const descreverViagem = (v: { data: Date; sentido: string }) => `${v.sentido === "VOLTA" ? "volta" : "ida"} de ${diaMes(v.data)}`;

// ---------------------------------------------------------------- Registro automático

/**
 * Chamado na transação que encerra a viagem. Devolve quantas faltas foram registradas.
 */
export async function registrarFaltasAoEncerrar(tx: Tx, viagemId: string) {
  const viagem = await tx.viagem.findUniqueOrThrow({
    where: { id: viagemId },
    select: { id: true, data: true, sentido: true, rota: { select: { nome: true } } },
  });
  const ausentes = await tx.checkin.findMany({
    where: { viagemId, status: { in: [...OCUPA_VAGA] }, embarcado: false },
    select: { alunoId: true },
  });
  if (ausentes.length === 0) return 0;
  const alunoIds = ausentes.map((a) => a.alunoId);
  const prazo = somarDias(new Date(), PRAZO_JUSTIFICATIVA_DIAS);

  await tx.falta.createMany({
    data: alunoIds.map((alunoId) => ({ alunoId, viagemId, prazoJustificativa: prazo })),
    skipDuplicates: true,
  });

  // Faltou na ida: a vaga da volta do mesmo dia vai para outro aluno (ou para a espera)
  const liberadas = new Set<string>();
  if (viagem.sentido === "IDA") {
    const volta = await viagemIrma(tx, viagemId);
    if (volta) {
      await travarViagens(tx, [volta.id]);
      const naVolta = await tx.checkin.findMany({
        where: { viagemId: volta.id, alunoId: { in: alunoIds }, status: { in: [...OCUPA_VAGA] } },
        select: { id: true, alunoId: true },
      });
      if (naVolta.length > 0) {
        await tx.checkin.updateMany({
          where: { id: { in: naVolta.map((c) => c.id) } },
          data: { status: "CANCELADO", motivoAusencia: "FALTOU_NA_IDA", canceladoEm: new Date() },
        });
        for (const c of naVolta) {
          liberadas.add(c.alunoId);
          await promoverProximoDaEspera(tx, volta.id);
        }
      }
    }
  }

  for (const alunoId of alunoIds) {
    await notificarAluno(tx, alunoId, {
      mensagem:
        `Falta registrada na ${descreverViagem(viagem)} (${viagem.rota.nome}). Justifique até ${diaMes(prazo)} em Perfil › Minhas faltas.` +
        (liberadas.has(alunoId) ? " Sua vaga na volta de hoje foi liberada." : ""),
      categoria: "FALTA",
    });
  }

  // Alerta quando o aluno chega a 3 faltas sem justificativa em 30 dias
  const desde = somarDias(new Date(), -JANELA_ALERTA_DIAS);
  const semJustificativa = await tx.falta.groupBy({
    by: ["alunoId"],
    where: { alunoId: { in: alunoIds }, status: "REGISTRADA", justificativa: null, criadoEm: { gte: desde } },
    _count: { _all: true },
  });
  const atingiram = semJustificativa.filter((g) => g._count._all === LIMITE_ALERTA).map((g) => g.alunoId);
  if (atingiram.length > 0) {
    const alunos = await tx.aluno.findMany({ where: { id: { in: atingiram } }, select: { usuario: { select: { nome: true } } } });
    for (const a of alunos) {
      await notificarAdmins(tx, {
        mensagem: `${a.usuario.nome} tem ${LIMITE_ALERTA} faltas sem justificativa nos últimos ${JANELA_ALERTA_DIAS} dias.`,
        categoria: "FALTA",
      });
    }
  }
  return alunoIds.length;
}

// ---------------------------------------------------------------- Aluno

async function alunoDoUsuario(usuarioId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId }, select: { id: true, usuario: { select: { nome: true } } } });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  return aluno;
}

/** Faltas do aluno + as ausências que ele avisou antes (não são faltas). */
export async function minhasFaltas(usuarioId: string) {
  const aluno = await alunoDoUsuario(usuarioId);
  return historicoDoAluno(aluno.id);
}

export async function historicoDoAluno(alunoId: string) {
  const [faltas, ausenciasAvisadas] = await Promise.all([
    prisma.falta.findMany({ where: { alunoId }, select: faltaPublica, orderBy: { criadoEm: "desc" }, take: 100 }),
    prisma.checkin.findMany({
      where: { alunoId, status: "CANCELADO", motivoAusencia: { not: null } },
      select: {
        id: true,
        motivoAusencia: true,
        canceladoEm: true,
        viagem: { select: { id: true, data: true, horario: true, sentido: true, rota: { select: { nome: true } } } },
      },
      orderBy: { canceladoEm: "desc" },
      take: 50,
    }),
  ]);
  return { faltas, ausenciasAvisadas };
}

export async function justificar(usuarioId: string, faltaId: string, texto: string, anexo?: Express.Multer.File) {
  const aluno = await alunoDoUsuario(usuarioId);
  const falta = await prisma.falta.findUnique({ where: { id: faltaId }, select: { alunoId: true } });
  if (!falta || falta.alunoId !== aluno.id) throw new AppError("FALTA_NAO_ENCONTRADA");

  let arquivo: { chave: string; nome: string; mimeType: string; tamanho: number } | null = null;
  if (anexo && anexo.size > 0) {
    const formato = detectarFormato(anexo.buffer);
    if (!formato) throw new AppError("TIPO_ARQUIVO_INVALIDO");
    arquivo = {
      chave: `faltas/${aluno.id}/${randomUUID()}.${formato.extensao}`,
      nome: nomeSeguro(anexo.originalname, formato.extensao, "anexo"),
      mimeType: formato.mimeType,
      tamanho: anexo.size,
    };
    await armazenamento.salvar(arquivo.chave, anexo.buffer);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM faltas WHERE id = ${faltaId} FOR UPDATE`;
      const atual = await tx.falta.findUniqueOrThrow({
        where: { id: faltaId },
        select: { status: true, justificativa: true, prazoJustificativa: true, viagem: { select: { data: true, sentido: true } } },
      });
      if (atual.status !== "REGISTRADA") throw new AppError("FALTA_JA_DECIDIDA");
      if (atual.justificativa) throw new AppError("JUSTIFICATIVA_JA_ENVIADA");
      if (atual.prazoJustificativa < new Date()) throw new AppError("PRAZO_JUSTIFICATIVA_ENCERRADO");

      const atualizada = await tx.falta.update({
        where: { id: faltaId },
        data: {
          justificativa: texto,
          justificadaEm: new Date(),
          ...(arquivo && { anexoArquivo: arquivo.chave, anexoNome: arquivo.nome, anexoMimeType: arquivo.mimeType, anexoTamanho: arquivo.tamanho }),
        },
        select: faltaPublica,
      });
      await registrarAuditoria(tx, {
        usuarioId,
        acao: "FALTA_JUSTIFICATIVA_ENVIADA",
        entidade: "Aluno",
        entidadeId: aluno.id,
        detalhes: { faltaId, viagem: descreverViagem(atual.viagem), anexo: arquivo?.nome ?? null },
      });
      await notificarAdmins(tx, { mensagem: `${aluno.usuario.nome} justificou a falta da ${descreverViagem(atual.viagem)}.`, categoria: "FALTA" });
      return atualizada;
    });
  } catch (err) {
    if (arquivo) await armazenamento.remover(arquivo.chave);
    throw err;
  }
}

// ---------------------------------------------------------------- Administração

export type Situacao = "AGUARDANDO_DECISAO" | "SEM_JUSTIFICATIVA" | "JUSTIFICADA" | "INDEFERIDA";

const porSituacao: Record<Situacao, Prisma.FaltaWhereInput> = {
  AGUARDANDO_DECISAO: { status: "REGISTRADA", justificativa: { not: null } },
  SEM_JUSTIFICATIVA: { status: "REGISTRADA", justificativa: null },
  JUSTIFICADA: { status: "JUSTIFICADA" },
  INDEFERIDA: { status: "INDEFERIDA" },
};

export interface FiltroFaltas {
  situacao?: Situacao;
  inicio?: string;
  fim?: string;
  universidadeId?: string;
  alunoId?: string;
  busca?: string;
  pagina: number;
  porPagina: number;
}

export async function listar(f: FiltroFaltas) {
  const busca = f.busca?.trim();
  const base: Prisma.FaltaWhereInput = {
    ...(f.alunoId && { alunoId: f.alunoId }),
    ...((f.inicio || f.fim) && { viagem: { data: intervaloDeDias(parseDia(f.inicio ?? f.fim!), parseDia(f.fim ?? f.inicio!)) } }),
    aluno: {
      ...(f.universidadeId && { universidadeId: f.universidadeId }),
      ...(busca && { OR: [{ usuario: { nome: { contains: busca } } }, { matricula: { contains: busca } }] }),
    },
  };
  const where = { ...base, ...(f.situacao && porSituacao[f.situacao]) };
  const situacoes = Object.keys(porSituacao) as Situacao[];
  const [itens, total, ...contagens] = await Promise.all([
    prisma.falta.findMany({
      where,
      select: {
        ...faltaPublica,
        aluno: { select: { id: true, matricula: true, usuario: { select: { nome: true } }, universidade: { select: { nome: true } } } },
      },
      // Quem espera decisão há mais tempo aparece primeiro
      orderBy: f.situacao === "AGUARDANDO_DECISAO" ? { justificadaEm: "asc" } : { criadoEm: "desc" },
      skip: (f.pagina - 1) * f.porPagina,
      take: f.porPagina,
    }),
    prisma.falta.count({ where }),
    ...situacoes.map((s) => prisma.falta.count({ where: { ...base, ...porSituacao[s] } })),
  ]);
  return {
    itens,
    total,
    pagina: f.pagina,
    porPagina: f.porPagina,
    contagens: Object.fromEntries(situacoes.map((s, i) => [s, contagens[i]])) as Record<Situacao, number>,
  };
}

/** Justificar (observação opcional) ou indeferir (motivo obrigatório) uma falta registrada. */
export async function decidir(adminId: string, faltaId: string, decisao: "JUSTIFICADA" | "INDEFERIDA", observacao?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM faltas WHERE id = ${faltaId} FOR UPDATE`;
    const falta = await tx.falta.findUnique({
      where: { id: faltaId },
      select: { status: true, alunoId: true, justificativa: true, viagem: { select: { data: true, sentido: true } } },
    });
    if (!falta) throw new AppError("FALTA_NAO_ENCONTRADA");
    if (falta.status !== "REGISTRADA") throw new AppError("FALTA_JA_DECIDIDA");

    const atualizada = await tx.falta.update({
      where: { id: faltaId },
      data: { status: decisao, decididoPorId: adminId, decididoEm: new Date(), observacaoDecisao: observacao || null },
      select: faltaPublica,
    });
    const viagem = descreverViagem(falta.viagem);
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: decisao === "JUSTIFICADA" ? "FALTA_JUSTIFICADA" : "FALTA_INDEFERIDA",
      entidade: "Aluno",
      entidadeId: falta.alunoId,
      detalhes: { faltaId, viagem, motivo: observacao || null, justificativaDoAluno: falta.justificativa },
      valorAnterior: { falta: "REGISTRADA" },
      valorNovo: { falta: decisao },
    });
    await notificarAluno(tx, falta.alunoId, {
      mensagem:
        decisao === "JUSTIFICADA"
          ? `Sua falta na ${viagem} foi justificada.`
          : `A justificativa da falta na ${viagem} foi indeferida: ${observacao}.`,
      categoria: "FALTA",
    });
    return atualizada;
  });
}

// ---------------------------------------------------------------- Anexo

export async function gerarLinkAnexo(faltaId: string, usuario: JwtPayload) {
  const falta = await prisma.falta.findUnique({
    where: { id: faltaId },
    select: { id: true, anexoArquivo: true, anexoMimeType: true, aluno: { select: { usuarioId: true } } },
  });
  const dono = falta?.aluno.usuarioId === usuario.sub;
  if (!falta || (!dono && !temPermissao(usuario.papel, "alunos:ler"))) throw new AppError("FALTA_NAO_ENCONTRADA");
  if (!falta.anexoArquivo) throw new AppError("ANEXO_NAO_ENCONTRADO");
  const link = assinarLink("falta", falta.id);
  return { caminho: `/faltas/${falta.id}/anexo?${link.query}`, expiraEm: link.expiraEm, mimeType: falta.anexoMimeType };
}

export async function abrirAnexo(faltaId: string, expira: number, assinatura: string) {
  verificarLink("falta", faltaId, expira, assinatura);
  const falta = await prisma.falta.findUnique({ where: { id: faltaId }, select: { anexoArquivo: true, anexoMimeType: true, anexoNome: true } });
  if (!falta?.anexoArquivo) throw new AppError("ANEXO_NAO_ENCONTRADO");
  return { ...(await armazenamento.abrir(falta.anexoArquivo)), mimeType: falta.anexoMimeType!, nomeOriginal: falta.anexoNome! };
}
