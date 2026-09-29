import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { autenticar, exigir } from "../../middlewares/auth";
import { AppError } from "../../errors/AppError";
import { formatarDia, intervaloDeDias, lerDiasSemana, NOMES_DIAS, parseDia, somarDias } from "../../utils/datas";
import { ocupacaoPorDia } from "../alocacao/alocacao.service";

export const dashboardRouter = Router();

dashboardRouter.use(autenticar, exigir("dashboard:ler"));

dashboardRouter.get("/resumo", async (_req, res, next) => {
  try {
    const [totalAlunos, totalMotoristas, totalOnibus, totalUniversidades, viagensAtivas, onibusEmManutencao, alunosAtivos, alunosPendentes, documentosPendentes] =
      await Promise.all([
        prisma.aluno.count(),
        prisma.motorista.count(),
        prisma.onibus.count(),
        prisma.universidade.count(),
        prisma.viagem.count({ where: { status: "EM_ANDAMENTO" } }),
        prisma.onibus.count({ where: { emManutencao: true } }),
        prisma.aluno.count({ where: { statusConta: "ATIVO" } }),
        prisma.aluno.count({ where: { statusConta: "PENDENTE" } }),
        prisma.documento.count({ where: { status: { in: ["PENDENTE", "EM_ANALISE"] } } }),
      ]);

    res.json({
      totalAlunos,
      totalMotoristas,
      totalOnibus,
      totalUniversidades,
      viagensAtivas,
      onibusEmManutencao,
      alunosAtivos,
      alunosPendentes,
      documentosPendentes,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Ocupação semanal: alunos alocados × lugares, por dia da semana, somando as
 * programações ativas (ex.: Seg 36/40), e o detalhe por rota.
 */
dashboardRouter.get("/ocupacao-semanal", async (_req, res, next) => {
  try {
    const programacoes = await prisma.programacao.findMany({
      where: { ativa: true },
      select: { rotaId: true, diasSemana: true, rota: { select: { nome: true } }, onibus: { select: { capacidade: true } } },
      orderBy: { rota: { nome: "asc" } },
    });
    const ocupacao = await ocupacaoPorDia(prisma, programacoes.map((p) => p.rotaId));
    const dias = NOMES_DIAS.map((nome, diaSemana) => ({ diaSemana, nome, alocados: 0, capacidade: 0 }));
    const rotas = programacoes.map((p) => ({
      rota: p.rota.nome,
      dias: lerDiasSemana(p.diasSemana).map((diaSemana) => {
        const alocados = ocupacao.get(`${p.rotaId}:${diaSemana}`) ?? 0;
        dias[diaSemana].alocados += alocados;
        dias[diaSemana].capacidade += p.onibus.capacidade;
        return { diaSemana, nome: NOMES_DIAS[diaSemana], alocados, capacidade: p.onibus.capacidade };
      }),
    }));
    res.json({ dias: dias.filter((d) => d.capacidade > 0), rotas });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/checkins-por-dia", async (_req, res, next) => {
  try {
    // Agrupamento simples dos check-ins dos últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const checkins = await prisma.checkin.findMany({
      where: { criadoEm: { gte: seteDiasAtras }, status: { in: ["CONFIRMADO", "ESPERA"] } },
      select: { criadoEm: true },
    });

    const porDia: Record<string, number> = {};
    for (const c of checkins) {
      const dia = formatarDia(c.criadoEm);
      porDia[dia] = (porDia[dia] ?? 0) + 1;
    }

    res.json(porDia);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/ocupacao-por-universidade", async (_req, res, next) => {
  try {
    const [grupos, universidades] = await Promise.all([
      prisma.aluno.groupBy({ by: ["universidadeId"], _count: { _all: true } }),
      prisma.universidade.findMany({ select: { id: true, nome: true } }),
    ]);
    const nomes = new Map(universidades.map((u) => [u.id, u.nome]));
    const contagem: Record<string, number> = {};
    for (const g of grupos) contagem[nomes.get(g.universidadeId) ?? "—"] = g._count._all;
    res.json(contagem);
  } catch (err) {
    next(err);
  }
});

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).");
const relatorioSchema = z.object({ inicio: dia.optional(), fim: dia.optional() });
const MAX_DIAS = 366;

/**
 * Relatório de presença do período (padrão: hoje).
 * Falta = aluno com vaga CONFIRMADA que não embarcou numa viagem já ENCERRADA.
 * Em viagens ainda não encerradas, quem não embarcou conta como "pendente".
 */
dashboardRouter.get("/relatorio", async (req, res, next) => {
  try {
    const q = relatorioSchema.parse(req.query);
    const hoje = formatarDia(new Date());
    const inicio = parseDia(q.inicio ?? q.fim ?? hoje);
    const fim = parseDia(q.fim ?? q.inicio ?? hoje);
    if (fim < inicio) throw new AppError("PERIODO_INVALIDO");
    const totalDias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
    if (totalDias > MAX_DIAS) throw new AppError("PERIODO_MUITO_LONGO");

    const viagens = await prisma.viagem.findMany({
      where: { data: intervaloDeDias(inicio, fim) },
      include: {
        rota: { select: { nome: true } },
        onibus: { select: { placa: true } },
        checkins: {
          // Programado = alocado no dia que não confirmou; se não embarcou, também é falta
          where: { status: { in: ["CONFIRMADO", "PROGRAMADO"] } },
          select: {
            embarcado: true,
            aluno: { select: { id: true, usuario: { select: { nome: true } }, universidade: { select: { nome: true } } } },
          },
        },
        // Faltas registradas ao encerrar (com a situação da justificativa)
        faltas: {
          select: {
            id: true,
            status: true,
            justificativa: true,
            aluno: { select: { id: true, usuario: { select: { nome: true } }, universidade: { select: { nome: true } } } },
          },
        },
      },
      orderBy: [{ data: "asc" }, { horario: "asc" }],
    });

    // Um ponto por dia do período (dias sem viagem aparecem zerados no gráfico)
    const porDia = new Map<string, { dia: string; viagens: number; confirmados: number; embarcados: number; faltas: number }>();
    for (let i = 0; i < totalDias; i++) {
      const d = formatarDia(somarDias(inicio, i));
      porDia.set(d, { dia: d, viagens: 0, confirmados: 0, embarcados: 0, faltas: 0 });
    }

    const totais = {
      viagens: 0,
      confirmados: 0,
      embarcados: 0,
      faltas: 0,
      pendentes: 0,
      faltasJustificadas: 0,
      faltasIndeferidas: 0,
      faltasAguardandoDecisao: 0,
      faltasSemJustificativa: 0,
    };
    const faltasPorUniversidade: Record<string, number> = {};
    const faltas: Array<{
      faltaId: string;
      alunoId: string;
      viagemId: string;
      dia: string;
      horario: string;
      rota: string;
      aluno: string;
      universidade: string;
      situacao: "SEM_JUSTIFICATIVA" | "AGUARDANDO_DECISAO" | "JUSTIFICADA" | "INDEFERIDA";
    }> = [];

    const resumoViagens = viagens.map((v) => {
      const d = formatarDia(v.data);
      const encerrada = v.status === "ENCERRADA";
      const embarcados = v.checkins.filter((c) => c.embarcado).length;
      const naoEmbarcados = v.checkins.filter((c) => !c.embarcado);
      const faltasDaViagem = v.faltas.length;

      const doDia = porDia.get(d)!;
      doDia.viagens += 1;
      doDia.confirmados += v.checkins.length;
      doDia.embarcados += embarcados;
      doDia.faltas += faltasDaViagem;

      totais.viagens += 1;
      totais.confirmados += v.checkins.length;
      totais.embarcados += embarcados;
      totais.faltas += faltasDaViagem;
      if (!encerrada) totais.pendentes += naoEmbarcados.length;

      for (const f of v.faltas) {
        const universidade = f.aluno.universidade.nome;
        faltasPorUniversidade[universidade] = (faltasPorUniversidade[universidade] ?? 0) + 1;
        const situacao =
          f.status === "REGISTRADA" ? (f.justificativa ? "AGUARDANDO_DECISAO" : "SEM_JUSTIFICATIVA") : f.status;
        if (situacao === "JUSTIFICADA") totais.faltasJustificadas += 1;
        else if (situacao === "INDEFERIDA") totais.faltasIndeferidas += 1;
        else if (situacao === "AGUARDANDO_DECISAO") totais.faltasAguardandoDecisao += 1;
        else totais.faltasSemJustificativa += 1;
        faltas.push({
          faltaId: f.id,
          alunoId: f.aluno.id,
          viagemId: v.id,
          dia: d,
          horario: v.horario,
          rota: v.rota.nome,
          aluno: f.aluno.usuario.nome,
          universidade,
          situacao,
        });
      }

      return {
        id: v.id,
        dia: d,
        horario: v.horario,
        rota: v.rota.nome,
        placa: v.onibus.placa,
        status: v.status,
        confirmados: v.checkins.length,
        embarcados,
        faltas: faltasDaViagem,
      };
    });

    // Presença só considera viagens encerradas (as outras ainda podem ter embarques)
    const baseEncerradas = resumoViagens
      .filter((v) => v.status === "ENCERRADA")
      .reduce((s, v) => s + v.confirmados, 0);
    const embarcadosEncerradas = resumoViagens
      .filter((v) => v.status === "ENCERRADA")
      .reduce((s, v) => s + v.embarcados, 0);

    faltas.sort((a, b) => b.dia.localeCompare(a.dia) || a.horario.localeCompare(b.horario) || a.aluno.localeCompare(b.aluno));

    res.json({
      periodo: { inicio: formatarDia(inicio), fim: formatarDia(fim), dias: totalDias },
      totais: { ...totais, taxaPresenca: baseEncerradas > 0 ? embarcadosEncerradas / baseEncerradas : null },
      porDia: [...porDia.values()],
      faltasPorUniversidade,
      viagens: resumoViagens,
      faltas,
    });
  } catch (err) {
    next(err);
  }
});
