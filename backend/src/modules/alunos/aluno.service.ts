import { Prisma, StatusConta } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { historico, registrarAuditoria } from "../auditoria/auditoria.service";
import { notificarAluno } from "../notificacoes/notificacao.service";
import { OPCOES_TX, revalidarDiasAoAtivar, revisarAlocacoes, sincronizarCheckins } from "../alocacao/alocacao.service";
import { documentoPublico } from "../documentos/documento.select";

const usuarioPublico = { select: { id: true, nome: true, email: true } } as const;

const alunoResumo = {
  id: true,
  matricula: true,
  curso: true,
  telefone: true,
  statusConta: true,
  criadoEm: true,
  usuario: usuarioPublico,
  universidade: { select: { id: true, nome: true } },
} satisfies Prisma.AlunoSelect;

export interface FiltroAlunos {
  busca?: string;
  status?: StatusConta;
  /** Só quem tem documento aguardando análise */
  documentoPendente?: boolean;
  universidadeId?: string;
  pagina: number;
  porPagina: number;
}

/** Lista para o admin: busca por nome, e-mail, matrícula ou universidade + filtros. */
export async function listar(f: FiltroAlunos) {
  const busca = f.busca?.trim();
  const where: Prisma.AlunoWhereInput = {
    ...(f.status && { statusConta: f.status }),
    ...(f.documentoPendente && { documentos: { some: { status: { in: ["PENDENTE", "EM_ANALISE"] } } } }),
    ...(f.universidadeId && { universidadeId: f.universidadeId }),
    ...(busca && {
      OR: [
        { usuario: { nome: { contains: busca } } },
        { usuario: { email: { contains: busca } } },
        { matricula: { contains: busca } },
        { universidade: { nome: { contains: busca } } },
      ],
    }),
  };

  // Contagens por status ignoram o filtro de status (para os chips mostrarem os totais)
  const { statusConta: _ignorado, ...whereSemStatus } = where;
  const [itens, total, porStatus, documentosPendentes] = await Promise.all([
    prisma.aluno.findMany({
      where,
      select: alunoResumo,
      orderBy: { usuario: { nome: "asc" } },
      skip: (f.pagina - 1) * f.porPagina,
      take: f.porPagina,
    }),
    prisma.aluno.count({ where }),
    prisma.aluno.groupBy({ by: ["statusConta"], where: whereSemStatus, _count: { _all: true } }),
    prisma.aluno.count({ where: { ...whereSemStatus, documentos: { some: { status: { in: ["PENDENTE", "EM_ANALISE"] } } } } }),
  ]);

  const contagens: Record<StatusConta, number> = { PENDENTE: 0, ATIVO: 0, INATIVO: 0 };
  for (const g of porStatus) contagens[g.statusConta] = g._count._all;

  return { itens, total, pagina: f.pagina, porPagina: f.porPagina, contagens, documentosPendentes };
}

/** Perfil completo (admin). */
export async function detalhar(alunoId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId }, select: alunoResumo });
  if (!aluno) throw new AppError("ALUNO_NAO_ENCONTRADO");
  const [dias, documentos, registros] = await Promise.all([
    prisma.alocacaoAluno.findMany({
      where: { alunoId, ativo: true },
      select: { diaSemana: true, rota: { select: { id: true, nome: true } }, pontoEmbarque: { select: { id: true, nome: true } } },
      orderBy: { diaSemana: "asc" },
    }),
    prisma.documento.findMany({ where: { alunoId }, select: documentoPublico, orderBy: { criadoEm: "desc" } }),
    historico("Aluno", alunoId),
  ]);
  return { ...aluno, dias, documentos, historico: registros };
}

/** Admin ativa/inativa (ou volta para pendente) a conta do aluno. */
export async function alterarStatus(alunoId: string, status: StatusConta, motivo: string | undefined, adminId: string) {
  return prisma.$transaction((tx) => alterarStatusNaTransacao(tx, alunoId, status, motivo, adminId), OPCOES_TX);
}

/** Mesma regra de alterarStatus, dentro de uma transação já aberta (ex.: aprovação de documento). */
export async function alterarStatusNaTransacao(
  tx: Prisma.TransactionClient,
  alunoId: string,
  status: StatusConta,
  motivo: string | undefined,
  adminId: string
) {
  const aluno = await tx.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno) throw new AppError("ALUNO_NAO_ENCONTRADO");
  if (aluno.statusConta === status) return aluno;

  const atualizado = await tx.aluno.update({ where: { id: alunoId }, data: { statusConta: status } });
  await registrarAuditoria(tx, {
    usuarioId: adminId,
    acao: "STATUS_CONTA_ALTERADO",
    entidade: "Aluno",
    entidadeId: alunoId,
    detalhes: { motivo: motivo ?? null },
    valorAnterior: { statusConta: aluno.statusConta },
    valorNovo: { statusConta: status },
  });

  const mensagens: Record<StatusConta, string> = {
    ATIVO: "Sua conta foi ativada. Você já pode usar o transporte.",
    INATIVO: `Sua conta foi inativada${motivo ? `: ${motivo}` : "."} Procure a administração do transporte.`,
    PENDENTE: `Seu cadastro voltou para análise${motivo ? `: ${motivo}` : "."}`,
  };
  await notificarAluno(tx, alunoId, { mensagem: mensagens[status], categoria: "CADASTRO" });

  // Dias de uso: só contam com a conta ATIVA. Reativado → os dias voltam (se ainda
  // houver vaga); inativado/pendente → sai das viagens programadas.
  if (status === "ATIVO") await revalidarDiasAoAtivar(tx, alunoId);
  else await sincronizarCheckins(tx, alunoId);
  return atualizado;
}

/** Dados do próprio aluno + o que falta para completar o cadastro. */
export async function meusDados(usuarioId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId }, select: alunoResumo });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  const pendencias: string[] = [];
  if (!aluno.matricula || !aluno.curso || !aluno.telefone) pendencias.push("DADOS_ACADEMICOS");
  const documento = await prisma.documento.findFirst({
    where: { alunoId: aluno.id },
    select: { id: true, status: true, motivoReprovacao: true, criadoEm: true },
    orderBy: { criadoEm: "desc" },
  });
  // Conta pendente sem documento (ou com o último reprovado): falta enviar o comprovante
  if (aluno.statusConta === "PENDENTE" && (!documento || documento.status === "REPROVADO")) pendencias.push("DOCUMENTO");
  // Conta ativa sem dias fixos: o app sugere escolher os dias de transporte
  if (aluno.statusConta === "ATIVO" && (await prisma.alocacaoAluno.count({ where: { alunoId: aluno.id, ativo: true } })) === 0) {
    pendencias.push("DIAS_DE_USO");
  }
  return { ...aluno, pendencias, documento };
}

export interface DadosAcademicos {
  nome?: string;
  matricula?: string;
  curso?: string;
  telefone?: string;
  universidadeId?: string;
}

export async function atualizarMeusDados(usuarioId: string, dados: DadosAcademicos) {
  return prisma.$transaction(async (tx) => {
    const aluno = await tx.aluno.findUnique({ where: { usuarioId } });
    if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");

    if (dados.matricula && dados.matricula !== aluno.matricula) {
      const dono = await tx.aluno.findUnique({ where: { matricula: dados.matricula } });
      if (dono) throw new AppError("MATRICULA_JA_CADASTRADA");
    }

    if (dados.nome) await tx.usuario.update({ where: { id: usuarioId }, data: { nome: dados.nome } });
    await tx.aluno.update({
      where: { id: aluno.id },
      data: {
        matricula: dados.matricula,
        curso: dados.curso,
        telefone: dados.telefone,
        universidadeId: dados.universidadeId,
      },
    });

    // Troca de universidade muda a rota do aluno: fica registrado
    if (dados.universidadeId && dados.universidadeId !== aluno.universidadeId) {
      await registrarAuditoria(tx, {
        usuarioId,
        acao: "UNIVERSIDADE_ALTERADA",
        entidade: "Aluno",
        entidadeId: aluno.id,
        valorAnterior: { universidadeId: aluno.universidadeId },
        valorNovo: { universidadeId: dados.universidadeId },
      });
      // Rotas que não passam pela nova instituição deixam de valer
      await revisarAlocacoes(tx, { alunoId: aluno.id }, usuarioId);
    }
    return { ok: true };
  }, OPCOES_TX).then(() => meusDados(usuarioId));
}
