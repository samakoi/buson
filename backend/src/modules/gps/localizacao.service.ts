import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../errors/AppError";
import { temPermissao } from "../../auth/permissoes";
import { JwtPayload } from "../../utils/jwt";
import { OCUPA_VAGA } from "../viagens/vagas";

/**
 * GPS dos ônibus (Fase 6):
 *  - O celular do motorista envia leituras em lote (também em segundo plano) só com a
 *    viagem EM ANDAMENTO; leituras imprecisas, repetidas ou fora de hora são descartadas.
 *  - A posição atual é vista por quem tem vaga na viagem, pelo motorista e pela administração.
 *  - Encerrou a viagem, o envio para e o aluno deixa de ver a posição.
 *  - O histórico fica GPS_RETENCAO_DIAS (padrão 90) e depois é apagado.
 */

type Tx = Prisma.TransactionClient;

export interface Leitura {
  latitude: number;
  longitude: number;
  velocidade?: number | null;
  direcao?: number | null;
  precisao?: number | null;
  registradoEm: Date;
}

const PRECISAO_MAXIMA_M = 150; // pior que isso é "chute" do celular (Wi-Fi/antena)
const ATRASO_MAXIMO_MS = 60 * 60 * 1000; // leituras guardadas sem internet por até 1 h
const ADIANTO_MAXIMO_MS = 2 * 60 * 1000; // relógio do celular um pouco adiantado
const POSICAO_RECENTE_MS = 5 * 60 * 1000; // para o embarque: posição de até 5 min atrás

/** Distância em metros entre duas coordenadas (fórmula de haversine). */
export function distanciaMetros(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const raio = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * raio * Math.asin(Math.sqrt(h)));
}

const posicaoPublica = {
  latitude: true,
  longitude: true,
  velocidade: true,
  direcao: true,
  precisao: true,
  registradoEm: true,
} satisfies Prisma.LocalizacaoViagemSelect;

async function ultima(db: Tx | typeof prisma, viagemId: string) {
  return db.localizacaoViagem.findFirst({ where: { viagemId }, orderBy: { registradoEm: "desc" }, select: posicaoPublica });
}

/** Recebe um lote de leituras do motorista. */
export async function registrar(viagemId: string, motoristaId: string, leituras: Leitura[]) {
  const viagem = await prisma.viagem.findUnique({ where: { id: viagemId }, select: { motoristaId: true, status: true } });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");
  if (viagem.motoristaId !== motoristaId) throw new AppError("VIAGEM_DE_OUTRO_MOTORISTA");
  if (viagem.status === "ENCERRADA") throw new AppError("VIAGEM_ENCERRADA");
  if (viagem.status !== "EM_ANDAMENTO") throw new AppError("VIAGEM_NAO_INICIADA");

  const agora = Date.now();
  const anterior = await ultima(prisma, viagemId);
  let limite = anterior?.registradoEm.getTime() ?? 0;
  const aceitas: Leitura[] = [];
  for (const l of [...leituras].sort((a, b) => a.registradoEm.getTime() - b.registradoEm.getTime())) {
    const t = l.registradoEm.getTime();
    if (l.precisao != null && l.precisao > PRECISAO_MAXIMA_M) continue;
    if (t > agora + ADIANTO_MAXIMO_MS || t < agora - ATRASO_MAXIMO_MS) continue;
    if (t <= limite) continue; // repetida ou mais antiga que a última guardada
    aceitas.push(l);
    limite = t;
  }
  if (aceitas.length > 0) {
    await prisma.localizacaoViagem.createMany({
      data: aceitas.map((l) => ({
        viagemId,
        latitude: l.latitude,
        longitude: l.longitude,
        velocidade: l.velocidade ?? null,
        direcao: l.direcao ?? null,
        precisao: l.precisao ?? null,
        registradoEm: l.registradoEm,
      })),
    });
  }
  return { aceitas: aceitas.length, descartadas: leituras.length - aceitas.length };
}

/**
 * Posição atual para a tela "Onde está o ônibus" (aluno), para o motorista e para o admin.
 * Inclui as paradas com coordenadas e, para o aluno, a distância até o ponto dele.
 */
export async function posicaoAtual(viagemId: string, usuario: JwtPayload) {
  const viagem = await prisma.viagem.findUnique({
    where: { id: viagemId },
    select: {
      id: true,
      status: true,
      sentido: true,
      horario: true,
      data: true,
      rota: {
        select: {
          nome: true,
          pontos: { orderBy: { ordem: "asc" }, select: { universidade: { select: { id: true, nome: true, latitude: true, longitude: true } } } },
          pontosEmbarque: { orderBy: { ordem: "asc" }, select: { pontoEmbarque: { select: { id: true, nome: true, latitude: true, longitude: true } } } },
        },
      },
      onibus: { select: { placa: true } },
      motorista: { select: { usuarioId: true } },
    },
  });
  if (!viagem) throw new AppError("VIAGEM_NAO_ENCONTRADA");

  // Quem pode ver: administração, o motorista da viagem e alunos com vaga nela
  let meuDestino: { tipo: "PONTO" | "INSTITUICAO"; nome: string; latitude: number; longitude: number } | null = null;
  if (usuario.papel === "ALUNO") {
    const aluno = await prisma.aluno.findUnique({ where: { usuarioId: usuario.sub }, select: { id: true, universidadeId: true } });
    const checkin = aluno
      ? await prisma.checkin.findUnique({
          where: { viagemId_alunoId: { viagemId, alunoId: aluno.id } },
          select: { status: true, pontoEmbarque: { select: { nome: true, latitude: true, longitude: true } } },
        })
      : null;
    if (!aluno || !checkin || !(OCUPA_VAGA as readonly string[]).includes(checkin.status)) throw new AppError("ACOMPANHAMENTO_NAO_PERMITIDO");
    // Na ida o aluno espera no ponto de embarque; na volta, na instituição
    const p = checkin.pontoEmbarque;
    const u = viagem.rota.pontos.find((x) => x.universidade.id === aluno.universidadeId)?.universidade;
    if (viagem.sentido === "IDA" && p?.latitude != null && p.longitude != null) {
      meuDestino = { tipo: "PONTO", nome: p.nome, latitude: p.latitude, longitude: p.longitude };
    } else if (viagem.sentido === "VOLTA" && u?.latitude != null && u.longitude != null) {
      meuDestino = { tipo: "INSTITUICAO", nome: u.nome, latitude: u.latitude, longitude: u.longitude };
    }
  } else if (usuario.papel === "MOTORISTA") {
    if (viagem.motorista.usuarioId !== usuario.sub) throw new AppError("VIAGEM_DE_OUTRO_MOTORISTA");
  } else if (!temPermissao(usuario.papel, "dashboard:ler")) {
    throw new AppError("SEM_PERMISSAO");
  }

  // O aluno só vê o ônibus com a viagem em andamento
  const posicao = usuario.papel !== "ALUNO" || viagem.status === "EM_ANDAMENTO" ? await ultima(prisma, viagemId) : null;
  const comCoordenadas = <T extends { latitude: number | null; longitude: number | null }>(x: T): x is T & { latitude: number; longitude: number } =>
    x.latitude != null && x.longitude != null;

  return {
    viagem: { id: viagem.id, status: viagem.status, sentido: viagem.sentido, horario: viagem.horario, rota: viagem.rota.nome, placa: viagem.onibus.placa },
    posicao,
    atualizadoHaSegundos: posicao ? Math.max(0, Math.round((Date.now() - posicao.registradoEm.getTime()) / 1000)) : null,
    paradas: [
      ...viagem.rota.pontosEmbarque.map((x) => ({ tipo: "PONTO" as const, ...x.pontoEmbarque })),
      ...viagem.rota.pontos.map((x) => ({ tipo: "INSTITUICAO" as const, ...x.universidade })),
    ].filter(comCoordenadas),
    meuDestino: meuDestino && {
      ...meuDestino,
      distanciaMetros: posicao ? distanciaMetros(posicao, meuDestino) : null,
    },
  };
}

/** Admin: viagens em andamento com a última posição (tela "Viagens ao vivo"). */
export async function aoVivo() {
  const viagens = await prisma.viagem.findMany({
    where: { status: "EM_ANDAMENTO" },
    select: {
      id: true,
      sentido: true,
      horario: true,
      rota: { select: { nome: true } },
      onibus: { select: { placa: true } },
      motorista: { select: { usuario: { select: { nome: true } } } },
      _count: { select: { embarques: true } },
    },
    orderBy: { horario: "asc" },
  });
  return Promise.all(
    viagens.map(async (v) => {
      const posicao = await ultima(prisma, v.id);
      return {
        id: v.id,
        sentido: v.sentido,
        horario: v.horario,
        rota: v.rota.nome,
        placa: v.onibus.placa,
        motorista: v.motorista.usuario.nome,
        embarcados: v._count.embarques,
        posicao,
        atualizadoHaSegundos: posicao ? Math.round((Date.now() - posicao.registradoEm.getTime()) / 1000) : null,
      };
    })
  );
}

/** Admin: trajeto percorrido (reduzido a no máximo 1500 pontos para desenhar). */
export async function trajeto(viagemId: string) {
  const pontos = await prisma.localizacaoViagem.findMany({
    where: { viagemId },
    orderBy: { registradoEm: "asc" },
    select: { latitude: true, longitude: true, registradoEm: true, velocidade: true },
  });
  const passo = Math.max(1, Math.ceil(pontos.length / 1500));
  const reduzido = pontos.filter((_, i) => i % passo === 0 || i === pontos.length - 1);
  let metros = 0;
  for (let i = 1; i < pontos.length; i++) metros += distanciaMetros(pontos[i - 1], pontos[i]);
  return { total: pontos.length, distanciaMetros: metros, pontos: reduzido };
}

/** Última posição recente do ônibus (para registrar onde o aluno embarcou). */
export async function posicaoRecente(db: Tx, viagemId: string) {
  const p = await ultima(db, viagemId);
  return p && Date.now() - p.registradoEm.getTime() <= POSICAO_RECENTE_MS ? p : null;
}

/** Apaga posições mais antigas que a retenção configurada. */
export async function limparHistorico() {
  const limite = new Date(Date.now() - env.gpsRetencaoDias * 86_400_000);
  const { count } = await prisma.localizacaoViagem.deleteMany({ where: { registradoEm: { lt: limite } } });
  return count;
}

export function iniciarLimpezaGps() {
  const rodar = async () => {
    try {
      const n = await limparHistorico();
      if (n > 0) logger.info({ apagadas: n, retencaoDias: env.gpsRetencaoDias }, "Histórico de GPS antigo apagado");
    } catch (err) {
      logger.error({ err }, "Falha ao limpar o histórico de GPS");
    }
  };
  void rodar();
  setInterval(rodar, 6 * 3600_000).unref();
}
