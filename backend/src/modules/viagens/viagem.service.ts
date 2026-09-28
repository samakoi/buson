import { Prisma, StatusViagem } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { JwtPayload } from "../../utils/jwt";
import { formatarDia, inicioDoDia, intervaloDeHoje, parseDia } from "../../utils/datas";
import { notificarAluno, notificarAlunos } from "../notificacoes/notificacao.service";
import { registrarAuditoria } from "../auditoria/auditoria.service";

/**
 * Regras de negócio implementadas aqui (ver Bus_On_Documentacao_Completa.docx, seção 3):
 *  - 3.1 Reserva antecipada: check-in fecha automaticamente ao atingir o limite de vagas.
 *  - 3.2 Lista de espera inteligente: cancelamento promove automaticamente o próximo da fila.
 *  - 3.3 Rota inteligente: pontos sem alunos confirmados são sinalizados como removidos do dia.
 *  - 3.5 QR Code: motorista confirma embarque validando o QR Code do aluno.
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
  embarcados: number;
  espera: number;
}

/** Quantos confirmados / embarcados / em espera cada viagem tem. */
async function resumirViagens(viagemIds: string[]) {
  const resumos = new Map<string, ResumoViagem>(
    viagemIds.map((id) => [id, { confirmados: 0, embarcados: 0, espera: 0 }])
  );
  if (viagemIds.length === 0) return resumos;

  const grupos = await prisma.checkin.groupBy({
    by: ["viagemId", "status", "embarcado"],
    where: { viagemId: { in: viagemIds }, status: { in: ["CONFIRMADO", "ESPERA"] } },
    _count: { _all: true },
  });
  for (const g of grupos) {
    const resumo = resumos.get(g.viagemId)!;
    if (g.status === "ESPERA") resumo.espera += g._count._all;
    if (g.status === "CONFIRMADO") {
      resumo.confirmados += g._count._all;
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
      checkins: { where: { alunoId: aluno.id }, select: { status: true, embarcado: true, criadoEm: true } },
    },
    orderBy: { horario: "asc" },
  });
  const resumos = await resumirViagens(viagens.map((v) => v.id));

  return Promise.all(
    viagens.map(async ({ checkins, ...viagem }) => {
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
        vagasRestantes: Math.max(0, viagem.vagas - resumo.confirmados),
        meuCheckin: meu ? { status: meu.status, embarcado: meu.embarcado, posicaoFila } : null,
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

  const [hora, minuto] = dados.horario.split(":").map(Number);
  dia.setHours(hora, minuto);

  return prisma.$transaction(async (tx) => {
    const viagem = await tx.viagem.create({
      data: {
        rotaId: dados.rotaId,
        onibusId: dados.onibusId,
        motoristaId: dados.motoristaId,
        data: dia,
        horario: dados.horario,
        vagas,
      },
      include: viagemInclude,
    });
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: "VIAGEM_CRIADA",
      entidade: "Viagem",
      entidadeId: viagem.id,
      valorNovo: { data: dados.data, horario: dados.horario, rota: viagem.rota.nome, onibus: viagem.onibus.placa, vagas },
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
      where: { viagemId, status: { in: ["CONFIRMADO", "ESPERA"] } },
      select: { alunoId: true },
    });
    const [ano, mes, dia] = formatarDia(viagem.data).split("-");
    await notificarAlunos(tx, ativos.map((c) => c.alunoId), {
      mensagem: `A viagem de ${dia}/${mes}/${ano} às ${viagem.horario} foi cancelada pela administração.`,
      categoria: "TRANSPORTE",
    });
    const rota = await tx.rota.findUnique({ where: { id: viagem.rotaId }, select: { nome: true } });
    await tx.viagem.delete({ where: { id: viagemId } });
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

export async function fazerCheckin(viagemId: string, alunoId: string) {
  return prisma.$transaction(async (tx) => {
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
    if (existente && existente.status !== "CANCELADO") {
      throw new AppError("CHECKIN_JA_ATIVO");
    }

    const confirmados = await tx.checkin.count({
      where: { viagemId, status: "CONFIRMADO" },
    });
    const status = confirmados < viagem.vagas ? "CONFIRMADO" : "ESPERA";

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

export async function cancelarCheckin(viagemId: string, alunoId: string) {
  return prisma.$transaction(async (tx) => {
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

    await tx.checkin.update({
      where: { id: checkin.id },
      data: { status: "CANCELADO" },
    });
    await notificarAluno(tx, alunoId, { mensagem: "Sua vaga foi liberada.", categoria: "TRANSPORTE" });

    // Regra 3.2 — Lista de espera inteligente: promove o próximo da fila
    if (checkin.status === "CONFIRMADO") {
      const proximo = await tx.checkin.findFirst({
        where: { viagemId, status: "ESPERA" },
        orderBy: { criadoEm: "asc" },
      });
      if (proximo) {
        await tx.checkin.update({
          where: { id: proximo.id },
          data: { status: "CONFIRMADO" },
        });
        await notificarAluno(tx, proximo.alunoId, { mensagem: "Boas notícias! Sua vaga foi confirmada automaticamente.", categoria: "TRANSPORTE" });
      }
    }

    return { ok: true };
  });
}

/** Regra 3.5 — o motorista lê o QR Code do aluno (Aluno.qrCode) e confirma o embarque. */
export async function confirmarEmbarque(viagemId: string, qrCode: string, motoristaId: string) {
  const viagem = await buscarViagemDoMotorista(viagemId, motoristaId);
  if (viagem.status !== "EM_ANDAMENTO") {
    throw new AppError("VIAGEM_NAO_INICIADA");
  }

  const aluno = await prisma.aluno.findUnique({
    where: { qrCode },
    include: { usuario: usuarioPublico, universidade: true },
  });
  if (!aluno) throw new AppError("QR_NAO_RECONHECIDO");

  const checkin = await prisma.checkin.findUnique({
    where: { viagemId_alunoId: { viagemId, alunoId: aluno.id } },
  });
  if (!checkin || checkin.status !== "CONFIRMADO") {
    throw new AppError("SEM_VAGA_CONFIRMADA", `${aluno.usuario.nome} não possui vaga confirmada nesta viagem.`);
  }
  if (checkin.embarcado) {
    throw new AppError("EMBARQUE_JA_CONFIRMADO", `O embarque de ${aluno.usuario.nome} já foi confirmado.`);
  }

  const atualizado = await prisma.checkin.update({
    where: { id: checkin.id },
    data: { embarcado: true },
  });
  return { ...atualizado, aluno: { nome: aluno.usuario.nome, universidade: aluno.universidade.nome } };
}

export async function listarPassageiros(viagemId: string, usuario: JwtPayload) {
  if (usuario.papel === "MOTORISTA") {
    const motorista = await prisma.motorista.findUnique({ where: { usuarioId: usuario.sub } });
    if (!motorista) throw new AppError("PERFIL_MOTORISTA_NAO_ENCONTRADO");
    await buscarViagemDoMotorista(viagemId, motorista.id);
  }

  return prisma.checkin.findMany({
    where: { viagemId, status: { in: ["CONFIRMADO", "ESPERA"] } },
    include: { aluno: { include: { usuario: usuarioPublico, universidade: true } } },
    orderBy: [{ status: "asc" }, { criadoEm: "asc" }],
  });
}

/** Regra 3.3 — Rota Inteligente */
export async function calcularRotaDoDia(viagemId: string) {
  const viagem = await prisma.viagem.findUnique({
    where: { id: viagemId },
    include: { rota: { include: { pontos: { include: { universidade: true }, orderBy: { ordem: "asc" } } } } },
  });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");

  const confirmados = await prisma.checkin.findMany({
    where: { viagemId, status: "CONFIRMADO" },
    include: { aluno: true },
  });

  return viagem.rota.pontos.map((ponto) => {
    const alunosNoPonto = confirmados.filter((c) => c.aluno.universidadeId === ponto.universidadeId).length;
    return {
      universidade: ponto.universidade.nome,
      alunosConfirmados: alunosNoPonto,
      ativoNoDia: alunosNoPonto > 0,
    };
  });
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
  const viagem = await buscarViagemDoMotorista(viagemId, motoristaId);
  if (viagem.status !== de) throw new AppError(erroTransicaoInvalida[para]);
  return prisma.viagem.update({ where: { id: viagemId }, data: { status: para } });
}

export async function atualizarLocalizacao(viagemId: string, motoristaId: string, latitude: number, longitude: number) {
  const viagem = await buscarViagemDoMotorista(viagemId, motoristaId);
  if (viagem.status !== "EM_ANDAMENTO") {
    throw new AppError("VIAGEM_NAO_INICIADA");
  }
  return prisma.viagem.update({ where: { id: viagemId }, data: { latitude, longitude } });
}

async function buscarViagemDoMotorista(viagemId: string, motoristaId: string) {
  const viagem = await prisma.viagem.findUnique({ where: { id: viagemId } });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");
  if (viagem.motoristaId !== motoristaId) {
    throw new AppError("VIAGEM_DE_OUTRO_MOTORISTA");
  }
  return viagem;
}
