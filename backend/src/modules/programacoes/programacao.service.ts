import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../errors/AppError";
import { comHorario, diaMes, inicioDoDia, intervaloDeDias, lerDiasSemana, NOMES_DIAS, somarDias } from "../../utils/datas";
import { diferenca, registrarAuditoria } from "../auditoria/auditoria.service";
import { OPCOES_TX, ocupacaoPorDia, revisarAlocacoes } from "../alocacao/alocacao.service";
import { chaveDataCancelada, excluirViagensComAviso, OCUPA_VAGA, travarViagens } from "../viagens/viagem.service";

/**
 * Programação semanal de cada rota: ônibus, motorista, horários de ida/volta e dias
 * de operação. Gera as viagens dos próximos dias (DIAS_GERACAO_VIAGENS) com os
 * alunos alocados já como PROGRAMADO. Mudanças valem também para as viagens futuras
 * que ainda não começaram.
 */

type Tx = Prisma.TransactionClient;

export interface DadosProgramacao {
  rotaId: string;
  onibusId: string;
  motoristaId: string;
  horarioIda: string;
  horarioVolta?: string | null;
  diasSemana: number[];
  ativa?: boolean;
}

const include = {
  rota: { select: { id: true, nome: true } },
  onibus: { select: { id: true, placa: true, capacidade: true, emManutencao: true } },
  motorista: { select: { id: true, usuario: { select: { nome: true } } } },
} satisfies Prisma.ProgramacaoInclude;

type ProgramacaoCompleta = Prisma.ProgramacaoGetPayload<{ include: typeof include }>;

async function comOcupacao(programacoes: ProgramacaoCompleta[]) {
  const ocupacao = await ocupacaoPorDia(prisma, programacoes.map((p) => p.rotaId));
  return programacoes.map((p) => ({
    ...p,
    diasSemana: lerDiasSemana(p.diasSemana),
    ocupacao: lerDiasSemana(p.diasSemana).map((diaSemana) => {
      const alocados = ocupacao.get(`${p.rotaId}:${diaSemana}`) ?? 0;
      return { diaSemana, nome: NOMES_DIAS[diaSemana], alocados, capacidade: p.onibus.capacidade, disponiveis: Math.max(0, p.onibus.capacidade - alocados) };
    }),
  }));
}

export async function listar() {
  const programacoes = await prisma.programacao.findMany({ include, orderBy: [{ ativa: "desc" }, { rota: { nome: "asc" } }] });
  return comOcupacao(programacoes);
}

export async function detalhar(id: string) {
  const programacao = await prisma.programacao.findUnique({ where: { id }, include });
  if (!programacao) throw new AppError("PROGRAMACAO_NAO_ENCONTRADA");
  return (await comOcupacao([programacao]))[0];
}

function validarHorarios(ida: string, volta: string | null | undefined) {
  if (volta && volta <= ida) throw new AppError("HORARIO_VOLTA_INVALIDO");
}

async function validarReferencias(tx: Tx, d: Pick<DadosProgramacao, "rotaId" | "onibusId" | "motoristaId">) {
  const [rota, onibus, motorista] = await Promise.all([
    tx.rota.findUnique({ where: { id: d.rotaId }, select: { id: true } }),
    tx.onibus.findUnique({ where: { id: d.onibusId }, select: { id: true } }),
    tx.motorista.findUnique({ where: { id: d.motoristaId }, select: { id: true } }),
  ]);
  if (!rota) throw new AppError("ROTA_NAO_CADASTRADA");
  if (!onibus) throw new AppError("ONIBUS_NAO_ENCONTRADO");
  if (!motorista) throw new AppError("MOTORISTA_NAO_ENCONTRADO");
}

async function garantirUnicaAtiva(tx: Tx, rotaId: string, excetoId?: string) {
  // Trava a rota: duas programações não viram "ativas" ao mesmo tempo para ela
  await tx.$queryRaw`SELECT id FROM rotas WHERE id = ${rotaId} FOR UPDATE`;
  const outra = await tx.programacao.findFirst({ where: { rotaId, ativa: true, ...(excetoId && { id: { not: excetoId } }) } });
  if (outra) throw new AppError("PROGRAMACAO_JA_ATIVA_NA_ROTA");
}

export async function criar(dados: DadosProgramacao, adminId: string) {
  validarHorarios(dados.horarioIda, dados.horarioVolta);
  const criada = await prisma.$transaction(async (tx) => {
    await validarReferencias(tx, dados);
    if (dados.ativa !== false) await garantirUnicaAtiva(tx, dados.rotaId);
    const programacao = await tx.programacao.create({
      data: { ...dados, horarioVolta: dados.horarioVolta ?? null, diasSemana: lerDiasSemana(dados.diasSemana) },
      include,
    });
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: "PROGRAMACAO_CRIADA",
      entidade: "Programacao",
      entidadeId: programacao.id,
      valorNovo: resumo(programacao),
    });
    return programacao;
  }, OPCOES_TX);
  await gerarViagens({ programacaoId: criada.id });
  return detalhar(criada.id);
}

function resumo(p: ProgramacaoCompleta) {
  return {
    rota: p.rota.nome,
    onibus: p.onibus.placa,
    motorista: p.motorista.usuario.nome,
    horarioIda: p.horarioIda,
    horarioVolta: p.horarioVolta,
    dias: lerDiasSemana(p.diasSemana).map((d) => NOMES_DIAS[d]),
    ativa: p.ativa,
  };
}

/** Viagens desta programação que ainda não começaram (de hoje em diante). */
async function viagensFuturas(tx: Tx, programacaoId: string) {
  return tx.viagem.findMany({
    where: { programacaoId, status: "AGUARDANDO", data: { gte: inicioDoDia() } },
    select: { id: true, data: true, sentido: true },
  });
}

/**
 * Confere se um ônibus comporta o que já está reservado: os alunos alocados em cada dia
 * e os ocupantes (programados + confirmados) das viagens futuras.
 */
async function conferirCapacidade(tx: Tx, rotaId: string, dias: number[], capacidade: number, viagemIds: string[]) {
  const ocupacao = await ocupacaoPorDia(tx, [rotaId]);
  const diasAcima = dias.filter((d) => (ocupacao.get(`${rotaId}:${d}`) ?? 0) > capacidade);
  if (diasAcima.length > 0) {
    const detalhe = diasAcima.map((d) => `${NOMES_DIAS[d]} (${ocupacao.get(`${rotaId}:${d}`)} alunos)`).join(", ");
    throw new AppError("CAPACIDADE_INSUFICIENTE", `O ônibus tem ${capacidade} lugares, mas já há mais alunos alocados em ${detalhe}.`, {
      dias: diasAcima,
    });
  }
  if (viagemIds.length === 0) return;
  const cheias = await tx.checkin.groupBy({
    by: ["viagemId"],
    where: { viagemId: { in: viagemIds }, status: { in: [...OCUPA_VAGA] } },
    _count: { _all: true },
  });
  const acima = cheias.filter((c) => c._count._all > capacidade);
  if (acima.length > 0) {
    const viagens = await tx.viagem.findMany({ where: { id: { in: acima.map((c) => c.viagemId) } }, select: { data: true } });
    throw new AppError(
      "CAPACIDADE_INSUFICIENTE",
      `O ônibus tem ${capacidade} lugares, mas as viagens de ${[...new Set(viagens.map((v) => diaMes(v.data)))].join(", ")} já têm mais passageiros confirmados.`
    );
  }
}

export async function atualizar(id: string, mudancas: Partial<Omit<DadosProgramacao, "rotaId">>, adminId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM programacoes WHERE id = ${id} FOR UPDATE`;
    const atual = await tx.programacao.findUnique({ where: { id }, include });
    if (!atual) throw new AppError("PROGRAMACAO_NAO_ENCONTRADA");

    const novo = {
      onibusId: mudancas.onibusId ?? atual.onibusId,
      motoristaId: mudancas.motoristaId ?? atual.motoristaId,
      horarioIda: mudancas.horarioIda ?? atual.horarioIda,
      horarioVolta: mudancas.horarioVolta !== undefined ? mudancas.horarioVolta : atual.horarioVolta,
      diasSemana: mudancas.diasSemana ? lerDiasSemana(mudancas.diasSemana) : lerDiasSemana(atual.diasSemana),
      ativa: mudancas.ativa ?? atual.ativa,
    };
    validarHorarios(novo.horarioIda, novo.horarioVolta);
    await validarReferencias(tx, { rotaId: atual.rotaId, onibusId: novo.onibusId, motoristaId: novo.motoristaId });
    if (novo.ativa && !atual.ativa) await garantirUnicaAtiva(tx, atual.rotaId, id);

    const onibus = await tx.onibus.findUniqueOrThrow({ where: { id: novo.onibusId }, select: { placa: true, capacidade: true } });
    const futuras = await viagensFuturas(tx, id);
    await travarViagens(tx, futuras.map((v) => v.id));

    // Viagens que deixam de existir: programação desativada, dia removido ou volta removida
    const saem = futuras.filter(
      (v) => !novo.ativa || !novo.diasSemana.includes(v.data.getDay()) || (v.sentido === "VOLTA" && !novo.horarioVolta)
    );
    const ficam = futuras.filter((v) => !saem.includes(v));
    if (novo.ativa) await conferirCapacidade(tx, atual.rotaId, novo.diasSemana, onibus.capacidade, ficam.map((v) => v.id));

    await tx.programacao.update({ where: { id }, data: novo });
    await excluirViagensComAviso(
      tx,
      saem.map((v) => v.id),
      novo.ativa ? "a programação da rota mudou." : "a programação da rota foi suspensa."
    );
    for (const v of ficam) {
      const horario = v.sentido === "IDA" ? novo.horarioIda : novo.horarioVolta!;
      await tx.viagem.update({
        where: { id: v.id },
        data: {
          onibusId: novo.onibusId,
          motoristaId: novo.motoristaId,
          vagas: onibus.capacidade,
          horario,
          data: comHorario(v.data, horario),
        },
      });
    }

    const depois = await tx.programacao.findUniqueOrThrow({ where: { id }, include });
    const { valorAnterior, valorNovo, mudou } = diferenca(resumo(atual), resumo(depois));
    if (mudou) {
      await registrarAuditoria(tx, { usuarioId: adminId, acao: "PROGRAMACAO_ALTERADA", entidade: "Programacao", entidadeId: id, valorAnterior, valorNovo });
    }
    // Dias que a rota deixou de atender: os alunos alocados neles são avisados
    await revisarAlocacoes(tx, { rotaId: atual.rotaId }, adminId);
  }, OPCOES_TX);

  await gerarViagens({ programacaoId: id });
  return detalhar(id);
}

/** Exclui a programação: as viagens futuras são canceladas; as já feitas ficam no histórico. */
export async function excluir(id: string, adminId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM programacoes WHERE id = ${id} FOR UPDATE`;
    const atual = await tx.programacao.findUnique({ where: { id }, include });
    if (!atual) throw new AppError("PROGRAMACAO_NAO_ENCONTRADA");
    const futuras = await viagensFuturas(tx, id);
    await excluirViagensComAviso(tx, futuras.map((v) => v.id), "a programação da rota foi encerrada.");
    await tx.programacao.delete({ where: { id } });
    await registrarAuditoria(tx, { usuarioId: adminId, acao: "PROGRAMACAO_EXCLUIDA", entidade: "Programacao", entidadeId: id, valorAnterior: resumo(atual) });
    await revisarAlocacoes(tx, { rotaId: atual.rotaId }, adminId);
  }, OPCOES_TX);
}

/**
 * Chamado quando a capacidade de um ônibus muda: confere as programações ativas que o
 * usam e atualiza as vagas das viagens futuras delas.
 */
export async function aplicarNovaCapacidade(tx: Tx, onibusId: string, capacidade: number) {
  const programacoes = await tx.programacao.findMany({ where: { onibusId, ativa: true }, select: { id: true, rotaId: true, diasSemana: true } });
  if (programacoes.length === 0) return;
  await tx.$queryRaw`SELECT id FROM programacoes WHERE id IN (${Prisma.join(programacoes.map((p) => p.id).sort())}) ORDER BY id FOR UPDATE`;
  for (const p of programacoes) {
    const futuras = await viagensFuturas(tx, p.id);
    await travarViagens(tx, futuras.map((v) => v.id));
    await conferirCapacidade(tx, p.rotaId, lerDiasSemana(p.diasSemana), capacidade, futuras.map((v) => v.id));
    await tx.viagem.updateMany({ where: { id: { in: futuras.map((v) => v.id) } }, data: { vagas: capacidade } });
  }
}

// ---------------------------------------------------------------- Geração de viagens

/**
 * Gera as viagens de ida e volta dos próximos dias para as programações ativas.
 * Idempotente: dias que já têm a viagem são pulados. Os alunos alocados no dia entram
 * como PROGRAMADO.
 */
export async function gerarViagens(opcoes: { programacaoId?: string; dias?: number } = {}) {
  const dias = opcoes.dias ?? env.diasGeracaoViagens;
  if (dias <= 0) return { criadas: 0 };
  const programacoes = await prisma.programacao.findMany({
    where: { ativa: true, ...(opcoes.programacaoId && { id: opcoes.programacaoId }) },
    select: { id: true },
  });
  let criadas = 0;
  for (const { id } of programacoes) {
    try {
      criadas += await gerarDaProgramacao(id, dias);
    } catch (err) {
      // Dois geradores ao mesmo tempo: o índice único (programação + sentido + data) barra a cópia
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  return { criadas };
}

async function gerarDaProgramacao(id: string, dias: number) {
  return prisma.$transaction(async (tx) => {
    // Trava a programação: mudanças de dias dos alunos desta rota esperam a geração terminar
    await tx.$queryRaw`SELECT id FROM programacoes WHERE id = ${id} FOR UPDATE`;
    const p = await tx.programacao.findUnique({ where: { id }, include: { onibus: { select: { capacidade: true } } } });
    if (!p || !p.ativa) return 0;

    const diasSemana = lerDiasSemana(p.diasSemana);
    const hoje = inicioDoDia();
    const existentes = await tx.viagem.findMany({
      where: { programacaoId: id, data: intervaloDeDias(hoje, somarDias(hoje, dias - 1)) },
      select: { sentido: true, data: true },
    });
    // Pula o que já existe e o que o admin cancelou (feriado etc.)
    const canceladas = Array.isArray(p.datasCanceladas) ? (p.datasCanceladas as string[]) : [];
    const jaExiste = new Set([...existentes.map((v) => chaveDataCancelada(v.sentido, v.data)), ...canceladas]);
    const agora = new Date();
    let criadas = 0;

    for (let i = 0; i < dias; i++) {
      const dia = somarDias(hoje, i);
      if (!diasSemana.includes(dia.getDay())) continue;
      const alocados = await tx.alocacaoAluno.findMany({
        where: { rotaId: p.rotaId, diaSemana: dia.getDay(), ativo: true, aluno: { statusConta: "ATIVO" } },
        select: { alunoId: true, pontoEmbarqueId: true },
        orderBy: { criadoEm: "asc" },
        take: p.onibus.capacidade,
      });
      const sentidos = [["IDA", p.horarioIda], ["VOLTA", p.horarioVolta]] as const;
      for (const [sentido, horario] of sentidos) {
        if (!horario || jaExiste.has(chaveDataCancelada(sentido, dia))) continue;
        const data = comHorario(dia, horario);
        if (data <= agora) continue; // horário de hoje que já passou
        await tx.viagem.create({
          data: {
            rotaId: p.rotaId,
            onibusId: p.onibusId,
            motoristaId: p.motoristaId,
            programacaoId: p.id,
            sentido,
            data,
            horario,
            vagas: p.onibus.capacidade,
            checkins: {
              create: alocados.map((a) => ({ alunoId: a.alunoId, status: "PROGRAMADO" as const, pontoEmbarqueId: a.pontoEmbarqueId })),
            },
          },
        });
        criadas++;
      }
    }
    return criadas;
  }, OPCOES_TX);
}

/** Roda a geração ao iniciar a API e depois a cada hora. */
export function iniciarAgendadorDeViagens() {
  if (env.diasGeracaoViagens <= 0) {
    logger.info("Geração automática de viagens desligada (DIAS_GERACAO_VIAGENS=0)");
    return;
  }
  const rodar = async () => {
    try {
      const { criadas } = await gerarViagens();
      if (criadas > 0) logger.info({ criadas }, `Programação semanal: ${criadas} viagem(ns) gerada(s)`);
    } catch (err) {
      logger.error({ err }, "Falha ao gerar as viagens da programação semanal");
    }
  };
  void rodar();
  setInterval(rodar, 60 * 60 * 1000).unref();
}

