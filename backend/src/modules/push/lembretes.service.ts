import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { comHorario, intervaloDeDias, somarDias } from "../../utils/datas";
import { notificarUsuario } from "../notificacoes/notificacao.service";
import { OCUPA_VAGA } from "../viagens/vagas";

/**
 * Lembretes de viagem (categoria LEMBRETE — o usuário pode desligar no celular):
 *  - Véspera: no horário LEMBRETE_VESPERA_HORARIO, um aviso por pessoa com as viagens de amanhã.
 *  - Saída: LEMBRETE_SAIDA_MINUTOS antes de cada viagem.
 * Programado sem confirmar recebe "confirme sua presença"; o motorista recebe o resumo.
 * Cada viagem é marcada ao ser lembrada, então nada se repete (nem se a API reiniciar).
 */

const carregarViagem = (id: string) =>
  prisma.viagem.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      horario: true,
      sentido: true,
      rota: { select: { nome: true } },
      motorista: { select: { usuarioId: true } },
      checkins: {
        where: { status: { in: [...OCUPA_VAGA] } },
        select: { status: true, aluno: { select: { usuarioId: true } }, pontoEmbarque: { select: { nome: true } } },
      },
    },
  });
type ViagemLembrete = Awaited<ReturnType<typeof carregarViagem>>;

const nomeSentido = (s: string) => (s === "VOLTA" ? "volta" : "ida");

/** Marca a viagem como lembrada; devolve false se outro ciclo já marcou. */
async function marcar(viagemId: string, campo: "lembreteVesperaEm" | "lembreteSaidaEm") {
  const { count } = await prisma.viagem.updateMany({ where: { id: viagemId, [campo]: null }, data: { [campo]: new Date() } });
  return count === 1;
}

export async function lembretesDeSaida(agora = new Date()) {
  const minutos = env.lembretes.saidaMinutos;
  if (!minutos) return 0;
  const viagens = await prisma.viagem.findMany({
    where: { status: "AGUARDANDO", lembreteSaidaEm: null, data: { gt: agora, lte: new Date(agora.getTime() + minutos * 60_000) } },
    select: { id: true },
  });
  let avisos = 0;
  for (const { id } of viagens) {
    if (!(await marcar(id, "lembreteSaidaEm"))) continue;
    const v = await carregarViagem(id);
    const sentido = nomeSentido(v.sentido);
    for (const c of v.checkins) {
      const ponto = v.sentido === "IDA" && c.pontoEmbarque ? ` Embarque em ${c.pontoEmbarque.nome}.` : "";
      await notificarUsuario(prisma, c.aluno.usuarioId, {
        mensagem:
          c.status === "PROGRAMADO"
            ? `Sua ${sentido} sai às ${v.horario} (${v.rota.nome}). Confirme sua presença no app.${ponto}`
            : `Sua ${sentido} sai às ${v.horario} (${v.rota.nome}).${ponto}`,
        categoria: "LEMBRETE",
      });
      avisos++;
    }
    await notificarUsuario(prisma, v.motorista.usuarioId, {
      mensagem: `Sua viagem de ${sentido} sai às ${v.horario} (${v.rota.nome}): ${v.checkins.length} passageiro(s).`,
      categoria: "LEMBRETE",
    });
    avisos++;
  }
  return avisos;
}

export async function lembretesDeVespera(agora = new Date()) {
  const horario = env.lembretes.vesperaHorario;
  if (!horario || agora < comHorario(agora, horario)) return 0;
  const candidatas = await prisma.viagem.findMany({
    where: { status: "AGUARDANDO", lembreteVesperaEm: null, data: intervaloDeDias(somarDias(agora, 1)) },
    select: { id: true },
    orderBy: { data: "asc" },
  });
  const viagens: ViagemLembrete[] = [];
  for (const { id } of candidatas) if (await marcar(id, "lembreteVesperaEm")) viagens.push(await carregarViagem(id));
  if (viagens.length === 0) return 0;

  // Um aviso por pessoa com todas as viagens de amanhã
  const porAluno = new Map<string, { trechos: string[]; confirmar: boolean; ponto: string | null }>();
  const porMotorista = new Map<string, string[]>();
  for (const v of viagens) {
    const trecho = `${nomeSentido(v.sentido)} às ${v.horario} (${v.rota.nome})`;
    for (const c of v.checkins) {
      const a = porAluno.get(c.aluno.usuarioId) ?? { trechos: [], confirmar: false, ponto: null };
      a.trechos.push(trecho);
      if (c.status === "PROGRAMADO") a.confirmar = true;
      if (v.sentido === "IDA" && c.pontoEmbarque) a.ponto = c.pontoEmbarque.nome;
      porAluno.set(c.aluno.usuarioId, a);
    }
    const m = porMotorista.get(v.motorista.usuarioId) ?? [];
    m.push(`${trecho}, ${v.checkins.length} passageiro(s)`);
    porMotorista.set(v.motorista.usuarioId, m);
  }
  const juntar = (itens: string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0]);

  for (const [usuarioId, a] of porAluno) {
    await notificarUsuario(prisma, usuarioId, {
      mensagem:
        `Amanhã você tem transporte: ${juntar(a.trechos)}.` +
        (a.ponto ? ` Embarque em ${a.ponto}.` : "") +
        (a.confirmar ? " Lembre de confirmar sua presença no app." : ""),
      categoria: "LEMBRETE",
    });
  }
  for (const [usuarioId, trechos] of porMotorista) {
    await notificarUsuario(prisma, usuarioId, { mensagem: `Amanhã você dirige: ${juntar(trechos)}.`, categoria: "LEMBRETE" });
  }
  return porAluno.size + porMotorista.size;
}

export function iniciarLembretes() {
  if (!env.lembretes.saidaMinutos && !env.lembretes.vesperaHorario) {
    logger.info("Lembretes de viagem desligados");
    return;
  }
  const rodar = async () => {
    try {
      const n = (await lembretesDeVespera()) + (await lembretesDeSaida());
      if (n > 0) logger.info({ avisos: n }, "Lembretes de viagem enviados");
    } catch (err) {
      logger.error({ err }, "Falha ao enviar lembretes de viagem");
    }
  };
  setInterval(rodar, env.lembretes.intervaloMs).unref();
}
