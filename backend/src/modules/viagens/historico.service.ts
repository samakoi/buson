import { Prisma, SentidoViagem, StatusFalta, StatusViagem } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { formatarDia, intervaloDeDias, parseDia, somarDias } from "../../utils/datas";
import { resumirViagens, viagemInclude } from "./viagem.service";

/** Período máximo de uma consulta (o mesmo do relatório de presença) e o padrão (últimos 30 dias). */
const MAX_DIAS = 366;
const DIAS_PADRAO = 30;

export interface FiltroHistorico {
  inicio?: string; // AAAA-MM-DD
  fim?: string;
  rotaId?: string;
  motoristaId?: string;
  sentido?: SentidoViagem;
  status?: StatusViagem;
  pagina: number;
  porPagina: number;
}

function periodo(f: Pick<FiltroHistorico, "inicio" | "fim">) {
  const fim = f.fim ? parseDia(f.fim) : parseDia(formatarDia(new Date()));
  const inicio = f.inicio ? parseDia(f.inicio) : somarDias(fim, -(DIAS_PADRAO - 1));
  if (fim < inicio) throw new AppError("PERIODO_INVALIDO");
  if (Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1 > MAX_DIAS) throw new AppError("PERIODO_MUITO_LONGO");
  return { inicio, fim };
}

/**
 * Histórico de viagens da administração: as mais recentes primeiro, paginado, com o resumo de
 * cada viagem (vagas ocupadas, embarques, espera, faltas) e os totais do período filtrado.
 */
export async function historico(f: FiltroHistorico) {
  const { inicio, fim } = periodo(f);
  const where: Prisma.ViagemWhereInput = {
    data: intervaloDeDias(inicio, fim),
    ...(f.rotaId && { rotaId: f.rotaId }),
    ...(f.motoristaId && { motoristaId: f.motoristaId }),
    ...(f.sentido && { sentido: f.sentido }),
    ...(f.status && { status: f.status }),
  };

  const [viagens, total, embarcados, faltas] = await Promise.all([
    prisma.viagem.findMany({
      where,
      include: viagemInclude,
      orderBy: [{ data: "desc" }, { horario: "desc" }],
      skip: (f.pagina - 1) * f.porPagina,
      take: f.porPagina,
    }),
    prisma.viagem.count({ where }),
    prisma.checkin.count({ where: { viagem: where, embarcado: true } }),
    prisma.falta.count({ where: { viagem: where } }),
  ]);

  const ids = viagens.map((v) => v.id);
  const [resumos, faltasPorViagem] = await Promise.all([
    resumirViagens(ids),
    prisma.falta.groupBy({ by: ["viagemId"], where: { viagemId: { in: ids } }, _count: { _all: true } }),
  ]);
  const faltasDe = new Map(faltasPorViagem.map((g) => [g.viagemId, g._count._all]));

  return {
    itens: viagens.map((v) => ({ ...v, resumo: { ...resumos.get(v.id)!, faltas: faltasDe.get(v.id) ?? 0 } })),
    total,
    pagina: f.pagina,
    porPagina: f.porPagina,
    periodo: { inicio: formatarDia(inicio), fim: formatarDia(fim) },
    totais: { viagens: total, embarcados, faltas },
  };
}

/** Situação de cada aluno na viagem, do ponto de vista de quem consulta depois. */
export type SituacaoPassageiro = "EMBARCOU" | "FALTOU" | "AUSENCIA_AVISADA" | "CANCELOU" | "ESPERA" | "PREVISTO";

/** Detalhe de uma viagem para a administração: dados, horários, números, passageiros e se há trajeto. */
export async function detalhe(viagemId: string) {
  const viagem = await prisma.viagem.findUnique({
    where: { id: viagemId },
    include: { ...viagemInclude, programacao: { select: { id: true } } },
  });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");

  const [checkins, embarques, faltas, pontosGps] = await Promise.all([
    prisma.checkin.findMany({
      where: { viagemId },
      select: {
        status: true,
        embarcado: true,
        motivoAusencia: true,
        canceladoEm: true,
        posicaoFila: true,
        criadoEm: true,
        pontoEmbarque: { select: { nome: true } },
        aluno: {
          select: { id: true, matricula: true, usuario: { select: { nome: true } }, universidade: { select: { nome: true } } },
        },
      },
      orderBy: { criadoEm: "asc" },
    }),
    prisma.embarque.findMany({ where: { viagemId }, select: { alunoId: true, dataHora: true, metodo: true } }),
    prisma.falta.findMany({ where: { viagemId }, select: { alunoId: true, status: true, justificativa: true } }),
    prisma.localizacaoViagem.count({ where: { viagemId } }),
  ]);
  const embarqueDe = new Map(embarques.map((e) => [e.alunoId, e]));
  const faltaDe = new Map(faltas.map((f) => [f.alunoId, f]));

  const passageiros = checkins.map((c) => {
    const falta = faltaDe.get(c.aluno.id);
    const embarque = embarqueDe.get(c.aluno.id);
    const situacao: SituacaoPassageiro = c.embarcado
      ? "EMBARCOU"
      : falta
        ? "FALTOU"
        : c.status === "CANCELADO"
          ? c.motivoAusencia
            ? "AUSENCIA_AVISADA"
            : "CANCELOU"
          : c.status === "ESPERA"
            ? "ESPERA"
            : "PREVISTO";
    return {
      alunoId: c.aluno.id,
      nome: c.aluno.usuario.nome,
      matricula: c.aluno.matricula,
      universidade: c.aluno.universidade.nome,
      pontoEmbarque: c.pontoEmbarque?.nome ?? null,
      situacao,
      embarqueEm: embarque?.dataHora ?? null,
      metodoEmbarque: embarque?.metodo ?? null,
      motivoAusencia: c.motivoAusencia,
      canceladoEm: c.canceladoEm,
      falta: falta ? { status: falta.status as StatusFalta, justificada: !!falta.justificativa } : null,
    };
  });

  // Ordem da lista: quem embarcou, faltou, avisou, cancelou, ficou na espera e os ainda previstos
  const ordem: SituacaoPassageiro[] = ["EMBARCOU", "FALTOU", "AUSENCIA_AVISADA", "CANCELOU", "ESPERA", "PREVISTO"];
  passageiros.sort((a, b) => ordem.indexOf(a.situacao) - ordem.indexOf(b.situacao) || a.nome.localeCompare(b.nome, "pt-BR"));

  const contar = (s: SituacaoPassageiro) => passageiros.filter((p) => p.situacao === s).length;
  const { programacao, ...dados } = viagem;
  return {
    viagem: { ...dados, avulsa: !programacao },
    resumo: {
      vagas: viagem.vagas,
      embarcaram: contar("EMBARCOU"),
      faltaram: contar("FALTOU"),
      ausenciasAvisadas: contar("AUSENCIA_AVISADA"),
      cancelaram: contar("CANCELOU"),
      espera: contar("ESPERA"),
      previstos: contar("PREVISTO"),
    },
    passageiros,
    gps: { pontos: pontosGps },
  };
}
