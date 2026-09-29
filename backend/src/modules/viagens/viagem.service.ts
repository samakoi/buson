import { MotivoAusencia, Prisma, SentidoViagem, StatusViagem } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { JwtPayload } from "../../utils/jwt";
import { comHorario, diaMes, formatarDia, inicioDoDia, intervaloDeHoje, parseDia } from "../../utils/datas";
import { notificarAluno, notificarAlunos } from "../notificacoes/notificacao.service";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { encerrarSessoes } from "../embarque/embarque.service";
import { OCUPA_VAGA, contarOcupados, promoverProximoDaEspera, travarViagens, viagemIrma } from "./vagas";
import { registrarFaltasAoEncerrar } from "../faltas/falta.service";
import { OPCOES_TX } from "../alocacao/alocacao.service";

export { OCUPA_VAGA, contarOcupados, promoverProximoDaEspera, travarViagens };

/**
 * Regras de negócio implementadas aqui (ver Bus_On_Documentacao_Completa.docx, seção 3):
 *  - 3.1 Reserva antecipada: check-in fecha automaticamente ao atingir o limite de vagas.
 *  - 3.2 Lista de espera inteligente: cancelamento promove automaticamente o próximo da fila.
 *  - 3.3 Rota inteligente: pontos sem alunos confirmados são sinalizados como removidos do dia.
 *  - 3.5 Embarque: o aluno escaneia o QR temporário do motorista (ver modules/embarque).
 *  - Alocação: viagens geradas pela programação semanal já nascem com os alunos alocados
 *    no dia como PROGRAMADO (vaga garantida). O aluno confirma a presença do dia (ida e
 *    volta) e as vagas que sobram ficam para check-ins avulsos, com lista de espera.
 */

type Tx = Prisma.TransactionClient;

// Nunca devolver o usuário inteiro (tem senhaHash) — só o que as telas usam
const usuarioPublico = { select: { id: true, nome: true } } as const;

const viagemInclude = {
  rota: true,
  onibus: true,
  motorista: { include: { usuario: usuarioPublico } },
} satisfies Prisma.ViagemInclude;

export interface ResumoViagem {
  confirmados: number;
  /** Alocados no dia que ainda não confirmaram (a vaga já é deles) */
  programados: number;
  /** confirmados + programados */
  ocupados: number;
  embarcados: number;
  espera: number;
}

/** Quantos confirmados / embarcados / em espera cada viagem tem. */
async function resumirViagens(viagemIds: string[]) {
  const resumos = new Map<string, ResumoViagem>(
    viagemIds.map((id) => [id, { confirmados: 0, programados: 0, ocupados: 0, embarcados: 0, espera: 0 }])
  );
  if (viagemIds.length === 0) return resumos;

  const grupos = await prisma.checkin.groupBy({
    by: ["viagemId", "status", "embarcado"],
    where: { viagemId: { in: viagemIds }, status: { in: ["CONFIRMADO", "PROGRAMADO", "ESPERA"] } },
    _count: { _all: true },
  });
  for (const g of grupos) {
    const resumo = resumos.get(g.viagemId)!;
    if (g.status === "ESPERA") resumo.espera += g._count._all;
    if (g.status === "CONFIRMADO") resumo.confirmados += g._count._all;
    if (g.status === "PROGRAMADO") resumo.programados += g._count._all;
    if (g.status !== "ESPERA") {
      resumo.ocupados += g._count._all;
      if (g.embarcado) resumo.embarcados += g._count._all;
    }
  }
  return resumos;
}

export interface FiltroViagensAdmin {
  desde?: string; // YYYY-MM-DD
}

/**
 * Lista as viagens visíveis para o usuário:
 *  - ADMIN: todas (ou a partir de `desde`)
 *  - MOTORISTA: as viagens de hoje atribuídas a ele
 *  - ALUNO: as viagens de hoje cuja rota passa pela universidade dele (com o check-in dele, se houver)
 */
export async function listarViagens(usuario: JwtPayload, filtro: FiltroViagensAdmin = {}) {
  if (usuario.papel === "ADMIN") {
    const viagens = await prisma.viagem.findMany({
      where: filtro.desde ? { data: { gte: parseDia(filtro.desde) } } : undefined,
      include: viagemInclude,
      orderBy: [{ data: "asc" }, { horario: "asc" }],
    });
    const resumos = await resumirViagens(viagens.map((v) => v.id));
    return viagens.map((v) => ({ ...v, resumo: resumos.get(v.id)! }));
  }

  if (usuario.papel === "MOTORISTA") {
    const motorista = await prisma.motorista.findUnique({ where: { usuarioId: usuario.sub } });
    if (!motorista) throw new AppError("PERFIL_MOTORISTA_NAO_ENCONTRADO");
    const viagens = await prisma.viagem.findMany({
      where: { motoristaId: motorista.id, data: intervaloDeHoje() },
      include: viagemInclude,
      orderBy: { horario: "asc" },
    });
    const resumos = await resumirViagens(viagens.map((v) => v.id));
    return viagens.map((v) => ({ ...v, resumo: resumos.get(v.id)! }));
  }

  const aluno = await prisma.aluno.findUnique({ where: { usuarioId: usuario.sub } });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  const viagens = await prisma.viagem.findMany({
    where: {
      data: intervaloDeHoje(),
      rota: { pontos: { some: { universidadeId: aluno.universidadeId } } },
    },
    include: {
      ...viagemInclude,
      checkins: {
        where: { alunoId: aluno.id },
        select: { status: true, embarcado: true, criadoEm: true, motivoAusencia: true, pontoEmbarque: { select: { id: true, nome: true } } },
      },
      embarques: { where: { alunoId: aluno.id }, select: { dataHora: true, metodo: true } },
    },
    orderBy: { horario: "asc" },
  });
  const resumos = await resumirViagens(viagens.map((v) => v.id));

  return Promise.all(
    viagens.map(async ({ checkins, embarques, ...viagem }) => {
      const resumo = resumos.get(viagem.id)!;
      const meu = checkins[0];
      // Posição na lista de espera = quantos entraram na fila antes dele + 1
      const posicaoFila =
        meu?.status === "ESPERA"
          ? (await prisma.checkin.count({
              where: { viagemId: viagem.id, status: "ESPERA", criadoEm: { lt: meu.criadoEm } },
            })) + 1
          : null;
      return {
        ...viagem,
        resumo,
        vagasRestantes: Math.max(0, viagem.vagas - resumo.ocupados),
        meuCheckin: meu
          ? {
              status: meu.status,
              embarcado: meu.embarcado,
              embarcadoEm: embarques[0]?.dataHora ?? null,
              posicaoFila,
              pontoEmbarque: meu.pontoEmbarque,
              motivoAusencia: meu.motivoAusencia,
            }
          : null,
      };
    })
  );
}

/** A viagem "do dia" do motorista/aluno: a próxima não encerrada ou, se todas acabaram, a última. */
export async function viagemAtual(usuario: JwtPayload) {
  const viagens = await listarViagens(usuario);
  return viagens.find((v) => v.status !== "ENCERRADA") ?? viagens[viagens.length - 1] ?? null;
}

export interface NovaViagem {
  rotaId: string;
  onibusId: string;
  motoristaId: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  vagas?: number;
  sentido?: SentidoViagem;
}

export async function criarViagem(dados: NovaViagem, adminId: string) {
  const dia = parseDia(dados.data);
  if (dia < inicioDoDia()) throw new AppError("DATA_PASSADA");

  const onibus = await prisma.onibus.findUnique({ where: { id: dados.onibusId } });
  if (!onibus) throw new AppError("ONIBUS_NAO_ENCONTRADO");
  const vagas = dados.vagas ?? onibus.capacidade;
  if (vagas > onibus.capacidade) {
    throw new AppError("VAGAS_ACIMA_DA_CAPACIDADE", `O ônibus ${onibus.placa} tem só ${onibus.capacidade} lugares.`);
  }

  return prisma.$transaction(async (tx) => {
    const viagem = await tx.viagem.create({
      data: {
        rotaId: dados.rotaId,
        onibusId: dados.onibusId,
        motoristaId: dados.motoristaId,
        data: comHorario(dia, dados.horario),
        horario: dados.horario,
        vagas,
        sentido: dados.sentido ?? "IDA",
      },
      include: viagemInclude,
    });
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: "VIAGEM_CRIADA",
      entidade: "Viagem",
      entidadeId: viagem.id,
      valorNovo: { data: dados.data, horario: dados.horario, sentido: viagem.sentido, rota: viagem.rota.nome, onibus: viagem.onibus.placa, vagas },
    });
    return viagem;
  });
}

/** Exclui uma viagem que ainda não começou, avisando quem tinha check-in. */
export async function excluirViagem(viagemId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const viagem = await travarViagem(tx, viagemId);
    if (viagem.status !== "AGUARDANDO") {
      throw new AppError("VIAGEM_NAO_PODE_SER_EXCLUIDA");
    }
    const ativos = await tx.checkin.findMany({
      where: { viagemId, status: { in: ["CONFIRMADO", "PROGRAMADO", "ESPERA"] } },
      select: { alunoId: true },
    });
    const [ano, mes, dia] = formatarDia(viagem.data).split("-");
    await notificarAlunos(tx, ativos.map((c) => c.alunoId), {
      mensagem: `A viagem de ${dia}/${mes}/${ano} às ${viagem.horario} foi cancelada pela administração.`,
      categoria: "VIAGEM",
    });
    const rota = await tx.rota.findUnique({ where: { id: viagem.rotaId }, select: { nome: true } });
    await tx.viagem.delete({ where: { id: viagemId } });
    // Viagem da programação semanal: a geração automática não pode recriá-la
    if (viagem.programacaoId) await marcarDataCancelada(tx, viagem.programacaoId, viagem.sentido, viagem.data);
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: "VIAGEM_CANCELADA",
      entidade: "Viagem",
      entidadeId: viagemId,
      valorAnterior: { data: formatarDia(viagem.data), horario: viagem.horario, rota: rota?.nome ?? null, alunosAvisados: ativos.length },
    });
    return { ok: true };
  });
}

/**
 * Trava a linha da viagem até o fim da transação. Serializa check-ins/cancelamentos
 * concorrentes da mesma viagem, evitando vender mais vagas do que existem.
 */
async function travarViagem(tx: Tx, viagemId: string) {
  await tx.$queryRaw`SELECT id FROM viagens WHERE id = ${viagemId} FOR UPDATE`;
  const viagem = await tx.viagem.findUnique({ where: { id: viagemId } });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");
  return viagem;
}

export const chaveDataCancelada = (sentido: SentidoViagem, data: Date) => `${sentido}:${formatarDia(data)}`;

async function marcarDataCancelada(tx: Tx, programacaoId: string, sentido: SentidoViagem, data: Date) {
  const programacao = await tx.programacao.findUnique({ where: { id: programacaoId }, select: { datasCanceladas: true } });
  if (!programacao) return;
  const hoje = formatarDia(new Date());
  const anteriores = Array.isArray(programacao.datasCanceladas) ? (programacao.datasCanceladas as string[]) : [];
  // Guarda só as datas que ainda não passaram
  const datas = [...new Set([...anteriores, chaveDataCancelada(sentido, data)])].filter((c) => c.split(":")[1] >= hoje).sort();
  await tx.programacao.update({ where: { id: programacaoId }, data: { datasCanceladas: datas } });
}

/** Exclui viagens que ainda não começaram, avisando quem tinha vaga ou estava na espera. */
export async function excluirViagensComAviso(tx: Tx, viagemIds: string[], motivo: string) {
  if (viagemIds.length === 0) return;
  await travarViagens(tx, viagemIds);
  const viagens = await tx.viagem.findMany({
    where: { id: { in: viagemIds }, status: "AGUARDANDO" },
    select: {
      id: true,
      data: true,
      horario: true,
      sentido: true,
      checkins: { where: { status: { in: ["CONFIRMADO", "PROGRAMADO", "ESPERA"] } }, select: { alunoId: true } },
    },
  });
  for (const v of viagens) {
    await notificarAlunos(tx, v.checkins.map((c) => c.alunoId), {
      mensagem: `A viagem de ${v.sentido === "VOLTA" ? "volta" : "ida"} de ${diaMes(v.data)} às ${v.horario} foi cancelada: ${motivo}`,
      categoria: "VIAGEM",
    });
  }
  await tx.viagem.deleteMany({ where: { id: { in: viagens.map((v) => v.id) } } });
}

/**
 * Check-in do aluno. Quem está PROGRAMADO (alocado no dia) apenas confirma a presença —
 * a confirmação vale para a ida e a volta do dia. Os demais pedem uma vaga avulsa:
 * confirmada se sobrar lugar, senão entram na lista de espera.
 */
export async function fazerCheckin(viagemId: string, alunoId: string) {
  return prisma.$transaction(async (tx) => {
    const irma = await viagemIrma(tx, viagemId);
    await travarViagens(tx, [viagemId, ...(irma ? [irma.id] : [])]);
    const viagem = await travarViagem(tx, viagemId);
    if (viagem.status !== "AGUARDANDO") {
      throw new AppError("CHECKIN_FECHADO");
    }

    const aluno = await tx.aluno.findUnique({ where: { id: alunoId }, select: { statusConta: true } });
    if (aluno?.statusConta === "INATIVO") {
      throw new AppError("CONTA_INATIVA");
    }

    const existente = await tx.checkin.findUnique({
      where: { viagemId_alunoId: { viagemId, alunoId } },
    });

    // Confirmação diária de quem já tem a vaga garantida pela alocação
    if (existente?.status === "PROGRAMADO") {
      const confirmado = await tx.checkin.update({ where: { id: existente.id }, data: { status: "CONFIRMADO" } });
      const daIrma = irma
        ? await tx.checkin.updateMany({ where: { viagemId: irma.id, alunoId, status: "PROGRAMADO" }, data: { status: "CONFIRMADO" } })
        : { count: 0 };
      await notificarAluno(tx, alunoId, {
        mensagem: daIrma.count > 0 ? "Presença confirmada para hoje (ida e volta)." : "Presença confirmada.",
        categoria: "TRANSPORTE",
      });
      return confirmado;
    }

    if (existente && existente.status !== "CANCELADO") {
      throw new AppError("CHECKIN_JA_ATIVO");
    }

    // Vagas avulsas: o que sobra depois dos alocados (programados) e confirmados
    const ocupados = await contarOcupados(tx, viagemId);
    const status = ocupados < viagem.vagas ? "CONFIRMADO" : "ESPERA";

    const checkin = await tx.checkin.upsert({
      where: { viagemId_alunoId: { viagemId, alunoId } },
      // Quem refaz o check-in vai para o fim da fila (a ordem da espera usa criadoEm)
      update: { status, embarcado: false, criadoEm: new Date() },
      create: { viagemId, alunoId, status },
    });

    await notificarAluno(tx, alunoId, {
      mensagem: status === "CONFIRMADO" ? "Sua vaga foi confirmada." : "Você entrou na lista de espera.",
      categoria: "TRANSPORTE",
    });

    return checkin;
  });
}

export interface OpcoesCancelamento {
  /** Motivo de quem libera a vaga antes da saída: vira "ausência avisada" (não é falta) */
  motivo?: MotivoAusencia;
  /** Liberar também a outra viagem do dia (ida ↔ volta), se o aluno tiver vaga nela */
  diaTodo?: boolean;
}

/**
 * Libera a vaga (ou sai da lista de espera) antes da saída. Com motivo, fica registrado
 * como ausência avisada — avisar antes não conta como falta.
 */
export async function cancelarCheckin(viagemId: string, alunoId: string, opcoes: OpcoesCancelamento = {}) {
  return prisma.$transaction(async (tx) => {
    const irma = opcoes.diaTodo ? await viagemIrma(tx, viagemId) : null;
    await travarViagens(tx, [viagemId, ...(irma ? [irma.id] : [])]);
    const viagem = await travarViagem(tx, viagemId);
    if (viagem.status !== "AGUARDANDO") {
      throw new AppError("CHECKIN_FECHADO");
    }

    const checkin = await tx.checkin.findUnique({
      where: { viagemId_alunoId: { viagemId, alunoId } },
    });
    if (!checkin || checkin.status === "CANCELADO") {
      throw new AppError("CHECKIN_NAO_ENCONTRADO");
    }

    const tinhaVaga = checkin.status === "CONFIRMADO" || checkin.status === "PROGRAMADO";
    await tx.checkin.update({
      where: { id: checkin.id },
      data: { status: "CANCELADO", canceladoEm: new Date(), motivoAusencia: tinhaVaga ? (opcoes.motivo ?? null) : null },
    });
    // Regra 3.2 — Lista de espera inteligente: promove o próximo da fila
    if (tinhaVaga) await promoverProximoDaEspera(tx, viagemId);

    let liberouIrma = false;
    if (irma) {
      const naIrma = await tx.checkin.findUnique({ where: { viagemId_alunoId: { viagemId: irma.id, alunoId } } });
      if (naIrma && naIrma.status !== "CANCELADO") {
        const vagaNaIrma = naIrma.status === "CONFIRMADO" || naIrma.status === "PROGRAMADO";
        await tx.checkin.update({
          where: { id: naIrma.id },
          data: { status: "CANCELADO", canceladoEm: new Date(), motivoAusencia: vagaNaIrma ? (opcoes.motivo ?? null) : null },
        });
        if (vagaNaIrma) await promoverProximoDaEspera(tx, irma.id);
        liberouIrma = true;
      }
    }

    await notificarAluno(tx, alunoId, {
      mensagem: liberouIrma ? "Suas vagas de ida e volta de hoje foram liberadas." : "Sua vaga foi liberada.",
      categoria: "TRANSPORTE",
    });
    return { ok: true, liberouIrma };
  }, OPCOES_TX);
}

export async function listarPassageiros(viagemId: string, usuario: JwtPayload) {
  if (usuario.papel === "MOTORISTA") {
    const motorista = await prisma.motorista.findUnique({ where: { usuarioId: usuario.sub } });
    if (!motorista) throw new AppError("PERFIL_MOTORISTA_NAO_ENCONTRADO");
    await buscarViagemDoMotorista(viagemId, motorista.id);
  }

  // Ordem do enum: CONFIRMADO, PROGRAMADO, ESPERA
  return prisma.checkin.findMany({
    where: { viagemId, status: { in: ["CONFIRMADO", "PROGRAMADO", "ESPERA"] } },
    include: {
      aluno: { select: { id: true, usuario: usuarioPublico, universidade: true } },
      pontoEmbarque: { select: { id: true, nome: true } },
    },
    orderBy: [{ status: "asc" }, { criadoEm: "asc" }],
  });
}

/**
 * Regra 3.3 — Rota Inteligente: as instituições (e os pontos de embarque) sem
 * alunos no dia são sinalizadas para o motorista pular.
 */
export async function calcularRotaDoDia(viagemId: string) {
  const viagem = await prisma.viagem.findUnique({
    where: { id: viagemId },
    include: {
      rota: {
        include: {
          pontos: { include: { universidade: true }, orderBy: { ordem: "asc" } },
          pontosEmbarque: { include: { pontoEmbarque: true }, orderBy: { ordem: "asc" } },
        },
      },
    },
  });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");

  const ocupantes = await prisma.checkin.findMany({
    where: { viagemId, status: { in: [...OCUPA_VAGA] } },
    select: { pontoEmbarqueId: true, aluno: { select: { universidadeId: true } } },
  });

  const universidades = viagem.rota.pontos.map((ponto) => {
    const alunosNoPonto = ocupantes.filter((c) => c.aluno.universidadeId === ponto.universidadeId).length;
    return {
      universidade: ponto.universidade.nome,
      alunosConfirmados: alunosNoPonto,
      ativoNoDia: alunosNoPonto > 0,
    };
  });
  const pontosEmbarque = viagem.rota.pontosEmbarque.map(({ pontoEmbarque }) => {
    const alunos = ocupantes.filter((c) => c.pontoEmbarqueId === pontoEmbarque.id).length;
    return { id: pontoEmbarque.id, nome: pontoEmbarque.nome, endereco: pontoEmbarque.endereco, alunos, ativoNoDia: alunos > 0 };
  });
  return { sentido: viagem.sentido, universidades, pontosEmbarque };
}

export async function iniciarViagem(viagemId: string, motoristaId: string) {
  const viagem = await prisma.viagem.findUnique({ where: { id: viagemId }, include: { onibus: true } });
  if (viagem?.onibus.emManutencao) {
    throw new AppError("ONIBUS_EM_MANUTENCAO", `O ônibus ${viagem.onibus.placa} está em manutenção. Fale com a administração.`);
  }
  return alterarStatusViagem(viagemId, motoristaId, "AGUARDANDO", "EM_ANDAMENTO");
}

export async function encerrarViagem(viagemId: string, motoristaId: string) {
  return alterarStatusViagem(viagemId, motoristaId, "EM_ANDAMENTO", "ENCERRADA");
}

const erroTransicaoInvalida = {
  EM_ANDAMENTO: "INICIO_INVALIDO",
  ENCERRADA: "ENCERRAMENTO_INVALIDO",
} as const;

async function alterarStatusViagem(viagemId: string, motoristaId: string, de: StatusViagem, para: "EM_ANDAMENTO" | "ENCERRADA") {
  await buscarViagemDoMotorista(viagemId, motoristaId);
  return prisma.$transaction(async (tx) => {
    // Só muda se ainda estiver no status esperado (dois toques em "Encerrar" não registram faltas duas vezes)
    const { count } = await tx.viagem.updateMany({ where: { id: viagemId, status: de }, data: { status: para } });
    if (count === 0) throw new AppError(erroTransicaoInvalida[para]);
    let faltasRegistradas = 0;
    if (para === "ENCERRADA") {
      // Viagem encerrada: o QR de embarque deixa de valer e quem tinha vaga e não embarcou leva falta
      await encerrarSessoes(tx, viagemId);
      faltasRegistradas = await registrarFaltasAoEncerrar(tx, viagemId);
    }
    const atualizada = await tx.viagem.findUniqueOrThrow({ where: { id: viagemId } });
    return { ...atualizada, faltasRegistradas };
  }, OPCOES_TX);
}


async function buscarViagemDoMotorista(viagemId: string, motoristaId: string) {
  const viagem = await prisma.viagem.findUnique({ where: { id: viagemId } });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");
  if (viagem.motoristaId !== motoristaId) {
    throw new AppError("VIAGEM_DE_OUTRO_MOTORISTA");
  }
  return viagem;
}
