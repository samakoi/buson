import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { diaMes, inicioDoDia, lerDiasSemana, NOMES_DIAS, nomesDosDias } from "../../utils/datas";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { notificarAluno } from "../notificacoes/notificacao.service";
import { contarOcupados, promoverProximoDaEspera, travarViagens } from "../viagens/viagem.service";

/**
 * Alocação do aluno por dia da semana (Regras 1, 3 e 5):
 *  - Cada rota tem uma programação semanal ativa; a capacidade de cada dia é a
 *    capacidade do ônibus dessa programação.
 *  - Contam só os dias ativos de alunos com a conta ATIVA.
 *  - A contagem roda na mesma transação, com a programação travada (FOR UPDATE):
 *    pedidos simultâneos para o mesmo dia são atendidos um de cada vez.
 *  - Dia lotado = bloqueado; o aluno escolhe outro dia (sem lista de espera por dia).
 *  - As viagens já geradas são ajustadas na hora (entra/sai o check-in PROGRAMADO).
 */

type Tx = Prisma.TransactionClient;

/** READ COMMITTED: cada consulta enxerga o que outras transações já confirmaram depois da trava. */
export const OPCOES_TX = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 20_000,
  timeout: 20_000,
};

export interface DiaEscolhido {
  diaSemana: number;
  rotaId: string;
  pontoEmbarqueId?: string | null;
}

/** Trava as programações ativas das rotas, sempre na mesma ordem (evita deadlock). */
export async function travarProgramacoesDasRotas(tx: Tx, rotaIds: string[]) {
  const ids = [...new Set(rotaIds)].sort();
  if (ids.length === 0) return [];
  await tx.$queryRaw`SELECT id FROM programacoes WHERE rotaId IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  return tx.programacao.findMany({
    where: { rotaId: { in: ids }, ativa: true },
    include: { onibus: { select: { placa: true, capacidade: true } } },
  });
}

const chave = (rotaId: string, dia: number) => `${rotaId}:${dia}`;

/** Quantos alunos (ATIVOS, dia ativo) cada rota tem em cada dia da semana. */
export async function ocupacaoPorDia(db: Tx | typeof prisma, rotaIds: string[], excetoAlunoId?: string) {
  const mapa = new Map<string, number>();
  if (rotaIds.length === 0) return mapa;
  const grupos = await db.alocacaoAluno.groupBy({
    by: ["rotaId", "diaSemana"],
    where: {
      rotaId: { in: [...new Set(rotaIds)] },
      ativo: true,
      aluno: { statusConta: "ATIVO" },
      ...(excetoAlunoId && { alunoId: { not: excetoAlunoId } }),
    },
    _count: { _all: true },
  });
  for (const g of grupos) mapa.set(chave(g.rotaId, g.diaSemana), g._count._all);
  return mapa;
}

async function descreverDias(tx: Tx, alunoId: string) {
  const dias = await tx.alocacaoAluno.findMany({
    where: { alunoId, ativo: true },
    select: { diaSemana: true, rota: { select: { nome: true } }, pontoEmbarque: { select: { nome: true } } },
    orderBy: { diaSemana: "asc" },
  });
  return dias.map((d) => ({ dia: NOMES_DIAS[d.diaSemana], rota: d.rota.nome, ponto: d.pontoEmbarque?.nome ?? null }));
}

export interface Autor {
  usuarioId: string;
  /** true = admin mexendo nos dias do aluno (o aluno é avisado) */
  admin: boolean;
}

/** Define os dias do aluno (substitui a lista inteira; lista vazia remove todos). */
export async function definirDias(alunoId: string, dias: DiaEscolhido[], autor: Autor) {
  await prisma.$transaction(async (tx) => {
    const aluno = await tx.aluno.findUnique({ where: { id: alunoId }, select: { statusConta: true, universidadeId: true } });
    if (!aluno) throw new AppError("ALUNO_NAO_ENCONTRADO");
    if (aluno.statusConta !== "ATIVO" && dias.length > 0) throw new AppError("CONTA_NAO_ATIVA");

    const atuais = await tx.alocacaoAluno.findMany({ where: { alunoId, ativo: true }, select: { rotaId: true } });
    const rotasNovas = [...new Set(dias.map((d) => d.rotaId))];
    // Trava as rotas de agora e as de antes: a geração de viagens dessas rotas espera esta transação
    const programacoes = await travarProgramacoesDasRotas(tx, [...rotasNovas, ...atuais.map((a) => a.rotaId)]);

    const rotas = await tx.rota.findMany({
      where: { id: { in: rotasNovas } },
      select: {
        id: true,
        nome: true,
        pontos: { select: { universidadeId: true } },
        pontosEmbarque: { select: { pontoEmbarqueId: true, pontoEmbarque: { select: { ativo: true } } } },
      },
    });
    for (const rotaId of rotasNovas) {
      const rota = rotas.find((r) => r.id === rotaId);
      if (!rota) throw new AppError("ROTA_NAO_CADASTRADA");
      if (!rota.pontos.some((p) => p.universidadeId === aluno.universidadeId)) {
        throw new AppError("ROTA_NAO_ATENDE_INSTITUICAO", `A rota ${rota.nome} não passa pela instituição do aluno.`);
      }
    }

    for (const d of dias) {
      const rota = rotas.find((r) => r.id === d.rotaId)!;
      const programacao = programacoes.find((p) => p.rotaId === d.rotaId);
      if (!programacao || !lerDiasSemana(programacao.diasSemana).includes(d.diaSemana)) {
        throw new AppError("DIA_SEM_TRANSPORTE", `Não há transporte na rota ${rota.nome} em ${NOMES_DIAS[d.diaSemana]}.`, {
          dias: [d.diaSemana],
        });
      }
      if (d.pontoEmbarqueId && !rota.pontosEmbarque.some((p) => p.pontoEmbarqueId === d.pontoEmbarqueId && p.pontoEmbarque.ativo)) {
        throw new AppError("PONTO_FORA_DA_ROTA");
      }
    }

    // Regra 1 — capacidade por dia (sem contar o próprio aluno)
    const ocupacao = await ocupacaoPorDia(tx, rotasNovas, alunoId);
    const lotados = dias.filter((d) => {
      const capacidade = programacoes.find((p) => p.rotaId === d.rotaId)!.onibus.capacidade;
      return (ocupacao.get(chave(d.rotaId, d.diaSemana)) ?? 0) >= capacidade;
    });
    if (lotados.length > 0) {
      const nums = lotados.map((d) => d.diaSemana);
      throw new AppError("DIAS_LOTADOS", `Não há mais vagas em ${nomesDosDias(nums)}. Escolha outro dia.`, { dias: nums });
    }

    const antes = await descreverDias(tx, alunoId);
    for (const d of dias) {
      const dados = { rotaId: d.rotaId, pontoEmbarqueId: d.pontoEmbarqueId ?? null, ativo: true };
      await tx.alocacaoAluno.upsert({
        where: { alunoId_diaSemana: { alunoId, diaSemana: d.diaSemana } },
        update: dados,
        create: { alunoId, diaSemana: d.diaSemana, ...dados },
      });
    }
    await tx.alocacaoAluno.updateMany({
      where: { alunoId, ativo: true, diaSemana: { notIn: dias.map((d) => d.diaSemana) } },
      data: { ativo: false },
    });
    const depois = await descreverDias(tx, alunoId);

    if (JSON.stringify(antes) !== JSON.stringify(depois)) {
      await registrarAuditoria(tx, {
        usuarioId: autor.usuarioId,
        acao: "DIAS_ALTERADOS",
        entidade: "Aluno",
        entidadeId: alunoId,
        valorAnterior: { dias: antes },
        valorNovo: { dias: depois },
      });
      if (autor.admin) {
        await notificarAluno(tx, alunoId, {
          mensagem:
            depois.length > 0
              ? `A administração atualizou seus dias de transporte: ${depois.map((d) => d.dia).join(", ")}.`
              : "A administração removeu seus dias de transporte.",
          categoria: "DIAS",
        });
      }
    }

    await sincronizarCheckins(tx, alunoId);
  }, OPCOES_TX);
}

/**
 * Deixa os check-ins PROGRAMADO das viagens futuras (ainda não iniciadas) iguais aos
 * dias do aluno: entra onde passou a ter o dia, sai de onde deixou de ter.
 * Check-ins confirmados, cancelados ou avulsos não são mexidos.
 */
export async function sincronizarCheckins(tx: Tx, alunoId: string) {
  const aluno = await tx.aluno.findUnique({ where: { id: alunoId }, select: { statusConta: true } });
  const alocacoes =
    aluno?.statusConta === "ATIVO"
      ? await tx.alocacaoAluno.findMany({ where: { alunoId, ativo: true }, select: { diaSemana: true, rotaId: true, pontoEmbarqueId: true } })
      : [];
  const rotaIds = [...new Set(alocacoes.map((a) => a.rotaId))];

  const candidatas = await tx.viagem.findMany({
    where: {
      status: "AGUARDANDO",
      programacaoId: { not: null },
      data: { gte: inicioDoDia() },
      OR: [{ rotaId: { in: rotaIds } }, { checkins: { some: { alunoId, status: "PROGRAMADO" } } }],
    },
    select: { id: true },
  });
  await travarViagens(tx, candidatas.map((v) => v.id));
  const viagens = await tx.viagem.findMany({
    where: { id: { in: candidatas.map((v) => v.id) }, status: "AGUARDANDO" },
    select: {
      id: true,
      data: true,
      rotaId: true,
      vagas: true,
      checkins: { where: { alunoId }, select: { id: true, status: true, pontoEmbarqueId: true } },
    },
    orderBy: { data: "asc" },
  });

  const semVaga: Date[] = [];
  for (const v of viagens) {
    const alocacao = alocacoes.find((a) => a.rotaId === v.rotaId && a.diaSemana === v.data.getDay());
    const meu = v.checkins[0];

    if (alocacao) {
      if (!meu || meu.status === "ESPERA") {
        // A capacidade do dia comporta o aluno, mas vagas avulsas já podem ter ocupado esta viagem
        const cabe = (await contarOcupados(tx, v.id)) < v.vagas;
        if (!meu) {
          await tx.checkin.create({
            data: { viagemId: v.id, alunoId, status: cabe ? "PROGRAMADO" : "ESPERA", pontoEmbarqueId: alocacao.pontoEmbarqueId },
          });
          if (!cabe) semVaga.push(v.data);
        } else if (cabe) {
          await tx.checkin.update({ where: { id: meu.id }, data: { status: "PROGRAMADO", pontoEmbarqueId: alocacao.pontoEmbarqueId } });
        }
      } else if (meu.status !== "CANCELADO" && meu.pontoEmbarqueId !== alocacao.pontoEmbarqueId) {
        await tx.checkin.update({ where: { id: meu.id }, data: { pontoEmbarqueId: alocacao.pontoEmbarqueId } });
      }
    } else if (meu?.status === "PROGRAMADO") {
      await tx.checkin.delete({ where: { id: meu.id } });
      await promoverProximoDaEspera(tx, v.id);
    }
  }

  if (semVaga.length > 0) {
    const datas = [...new Set(semVaga.map(diaMes))].join(", ");
    await notificarAluno(tx, alunoId, {
      mensagem: `Seus dias foram salvos, mas as viagens de ${datas} já estavam cheias com vagas avulsas: você está na lista de espera delas. Nas próximas semanas a vaga é garantida.`,
      categoria: "DIAS",
    });
  }
}

/**
 * Revê as alocações depois de uma mudança na rota, na programação ou no aluno:
 * dias que a rota deixou de atender (ou que não passam mais pela instituição do aluno)
 * são desativados e o aluno é avisado para escolher outro dia. Pontos de embarque que
 * saíram da rota são desmarcados.
 */
export async function revisarAlocacoes(tx: Tx, filtro: { rotaId: string } | { alunoId: string }, autorId: string | null) {
  const alocacoes = await tx.alocacaoAluno.findMany({
    where: { ...filtro, ativo: true },
    select: {
      id: true,
      alunoId: true,
      diaSemana: true,
      pontoEmbarqueId: true,
      aluno: { select: { universidadeId: true } },
      rota: {
        select: {
          nome: true,
          pontos: { select: { universidadeId: true } },
          pontosEmbarque: { select: { pontoEmbarqueId: true } },
          programacoes: { where: { ativa: true }, select: { diasSemana: true } },
        },
      },
    },
  });

  const removidos = new Map<string, { rota: string; dias: number[] }>();
  const semPonto = new Map<string, string>(); // alunoId → rota
  const alterados = new Set<string>();
  for (const a of alocacoes) {
    const diasDaRota = a.rota.programacoes.flatMap((p) => lerDiasSemana(p.diasSemana));
    const valida = diasDaRota.includes(a.diaSemana) && a.rota.pontos.some((p) => p.universidadeId === a.aluno.universidadeId);
    if (!valida) {
      await tx.alocacaoAluno.update({ where: { id: a.id }, data: { ativo: false } });
      const r = removidos.get(a.alunoId) ?? { rota: a.rota.nome, dias: [] };
      r.dias.push(a.diaSemana);
      removidos.set(a.alunoId, r);
      alterados.add(a.alunoId);
    } else if (a.pontoEmbarqueId && !a.rota.pontosEmbarque.some((p) => p.pontoEmbarqueId === a.pontoEmbarqueId)) {
      await tx.alocacaoAluno.update({ where: { id: a.id }, data: { pontoEmbarqueId: null } });
      semPonto.set(a.alunoId, a.rota.nome);
      alterados.add(a.alunoId);
    }
  }

  for (const [alunoId, { rota, dias }] of removidos) {
    await registrarAuditoria(tx, {
      usuarioId: autorId,
      acao: "DIAS_REMOVIDOS_PELO_SISTEMA",
      entidade: "Aluno",
      entidadeId: alunoId,
      valorAnterior: { rota, dias: dias.map((d) => NOMES_DIAS[d]) },
    });
    await notificarAluno(tx, alunoId, {
      mensagem: `A rota ${rota} não atende mais você em ${nomesDosDias(dias)}. Escolha outro dia em "Meus dias".`,
      categoria: "DIAS",
    });
  }
  for (const [alunoId, rota] of semPonto) {
    await notificarAluno(tx, alunoId, {
      mensagem: `Seu ponto de embarque saiu da rota ${rota}. Escolha um novo ponto em "Meus dias".`,
      categoria: "DIAS",
    });
  }
  for (const alunoId of alterados) await sincronizarCheckins(tx, alunoId);
}

/**
 * Conta reativada: os dias guardados voltam a contar. Se algum dia lotou enquanto a
 * conta estava parada, ele é desativado e o aluno é avisado.
 */
export async function revalidarDiasAoAtivar(tx: Tx, alunoId: string) {
  const alocacoes = await tx.alocacaoAluno.findMany({ where: { alunoId, ativo: true }, select: { id: true, rotaId: true, diaSemana: true } });
  if (alocacoes.length > 0) {
    const programacoes = await travarProgramacoesDasRotas(tx, alocacoes.map((a) => a.rotaId));
    const ocupacao = await ocupacaoPorDia(tx, alocacoes.map((a) => a.rotaId), alunoId);
    const lotados = alocacoes.filter((a) => {
      const programacao = programacoes.find((p) => p.rotaId === a.rotaId);
      return !programacao || (ocupacao.get(chave(a.rotaId, a.diaSemana)) ?? 0) >= programacao.onibus.capacidade;
    });
    if (lotados.length > 0) {
      await tx.alocacaoAluno.updateMany({ where: { id: { in: lotados.map((a) => a.id) } }, data: { ativo: false } });
      await notificarAluno(tx, alunoId, {
        mensagem: `Enquanto sua conta estava parada, ${nomesDosDias(lotados.map((a) => a.diaSemana))} lotou. Escolha outro dia em "Meus dias".`,
        categoria: "DIAS",
      });
    }
  }
  await revisarAlocacoes(tx, { alunoId }, null);
  await sincronizarCheckins(tx, alunoId);
}

/** Dias do aluno + as opções de rota/dia com as vagas de cada dia (para a tela "Meus dias"). */
export async function diasDoAluno(alunoId: string) {
  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    select: { statusConta: true, universidade: { select: { id: true, nome: true } } },
  });
  if (!aluno) throw new AppError("ALUNO_NAO_ENCONTRADO");

  const [dias, programacoes] = await Promise.all([
    prisma.alocacaoAluno.findMany({
      where: { alunoId, ativo: true },
      select: {
        diaSemana: true,
        rota: { select: { id: true, nome: true } },
        pontoEmbarque: { select: { id: true, nome: true } },
      },
      orderBy: { diaSemana: "asc" },
    }),
    prisma.programacao.findMany({
      where: { ativa: true, rota: { pontos: { some: { universidadeId: aluno.universidade.id } } } },
      select: {
        horarioIda: true,
        horarioVolta: true,
        diasSemana: true,
        onibus: { select: { capacidade: true } },
        rota: {
          select: {
            id: true,
            nome: true,
            pontos: { select: { universidade: { select: { nome: true } } }, orderBy: { ordem: "asc" } },
            pontosEmbarque: {
              where: { pontoEmbarque: { ativo: true } },
              select: { pontoEmbarque: { select: { id: true, nome: true, endereco: true } } },
              orderBy: { ordem: "asc" },
            },
          },
        },
      },
      orderBy: { rota: { nome: "asc" } },
    }),
  ]);

  const ocupacao = await ocupacaoPorDia(prisma, programacoes.map((p) => p.rota.id), alunoId);
  const opcoes = programacoes.map((p) => ({
    rota: { id: p.rota.id, nome: p.rota.nome, instituicoes: p.rota.pontos.map((x) => x.universidade.nome) },
    horarioIda: p.horarioIda,
    horarioVolta: p.horarioVolta,
    pontosEmbarque: p.rota.pontosEmbarque.map((x) => x.pontoEmbarque),
    dias: lerDiasSemana(p.diasSemana).map((diaSemana) => {
      const outros = ocupacao.get(chave(p.rota.id, diaSemana)) ?? 0;
      return {
        diaSemana,
        nome: NOMES_DIAS[diaSemana],
        capacidade: p.onibus.capacidade,
        ocupados: outros,
        disponiveis: Math.max(0, p.onibus.capacidade - outros),
      };
    }),
  }));

  return { statusConta: aluno.statusConta, universidade: aluno.universidade, dias, opcoes };
}
