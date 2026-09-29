import { CategoriaNotificacao, PlataformaPush, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../errors/AppError";
import { carteiro, Mensagem, tokenValido } from "./carteiro";

/**
 * Push no celular (Fase 5):
 *  - Todo aviso gravado entra na fila (pushStatus PENDENTE). Um processo em segundo plano
 *    envia em lotes; falha do push nunca desfaz a ação que gerou o aviso.
 *  - Um usuário pode ter vários aparelhos; tokens recusados (app desinstalado) são desativados.
 *  - Recibos são conferidos depois (o Expo recomenda ~15 min) para achar tokens que morreram.
 *  - Preferências: o usuário pode desligar só LEMBRETE e TRANSPORTE (vaga/espera). Os demais
 *    (cadastro, documentos, faltas, viagem cancelada...) sempre são enviados.
 */

export const DESLIGAVEIS: CategoriaNotificacao[] = ["LEMBRETE", "TRANSPORTE"];
const MAX_TENTATIVAS = 5;
const VALIDADE_HORAS = 24; // aviso que não saiu em 24 h não vai mais para o celular
const LOTE = 200;

const TITULOS: Record<CategoriaNotificacao, string> = {
  GERAL: "Bus On",
  CADASTRO: "Seu cadastro",
  DOCUMENTO: "Documentação",
  LEMBRETE: "Lembrete de viagem",
  DIAS: "Seus dias de transporte",
  FALTA: "Faltas",
  TRANSPORTE: "Transporte",
  LIBERACAO: "Liberação",
  ROTA: "Rota",
  VIAGEM: "Aviso da viagem",
};

function lerDesligadas(valor: Prisma.JsonValue | null): CategoriaNotificacao[] {
  return Array.isArray(valor) ? (valor.filter((c) => DESLIGAVEIS.includes(c as CategoriaNotificacao)) as CategoriaNotificacao[]) : [];
}

// ---------------------------------------------------------------- Fila

let processando = false;

/** Envia os avisos pendentes. Devolve quantos avisos saíram para pelo menos um aparelho. */
export async function processarFila() {
  if (!carteiro || processando) return 0;
  processando = true;
  try {
    const vencimento = new Date(Date.now() - VALIDADE_HORAS * 3600_000);
    await prisma.notificacao.updateMany({ where: { pushStatus: "PENDENTE", criadoEm: { lt: vencimento } }, data: { pushStatus: "IGNORADO" } });

    const candidatos = await prisma.notificacao.findMany({
      where: { pushStatus: "PENDENTE" },
      orderBy: { criadoEm: "asc" },
      take: LOTE,
      select: { id: true },
    });
    if (candidatos.length === 0) return 0;
    const ids = candidatos.map((c) => c.id);
    // Reserva o lote (se houver mais de um processo, cada aviso sai uma vez só)
    await prisma.notificacao.updateMany({ where: { id: { in: ids }, pushStatus: "PENDENTE" }, data: { pushStatus: "ENVIANDO" } });
    const avisos = await prisma.notificacao.findMany({
      where: { id: { in: ids }, pushStatus: "ENVIANDO" },
      select: {
        id: true,
        mensagem: true,
        categoria: true,
        pushTentativas: true,
        usuario: { select: { papel: true, pushDesligado: true, dispositivosPush: { where: { ativo: true }, select: { id: true, token: true } } } },
      },
    });

    const envio: { avisoId: string; dispositivoId: string; mensagem: Mensagem }[] = [];
    const semDispositivo: string[] = [];
    const desligados: string[] = [];
    for (const a of avisos) {
      if (lerDesligadas(a.usuario.pushDesligado).includes(a.categoria)) desligados.push(a.id);
      else if (a.usuario.dispositivosPush.length === 0) semDispositivo.push(a.id);
      else {
        for (const d of a.usuario.dispositivosPush) {
          envio.push({
            avisoId: a.id,
            dispositivoId: d.id,
            // O app usa categoria + papel para abrir a tela certa ao tocar no aviso
            mensagem: { para: d.token, titulo: TITULOS[a.categoria], corpo: a.mensagem, dados: { notificacaoId: a.id, categoria: a.categoria, papel: a.usuario.papel } },
          });
        }
      }
    }
    if (desligados.length) await prisma.notificacao.updateMany({ where: { id: { in: desligados } }, data: { pushStatus: "DESLIGADO" } });
    if (semDispositivo.length) await prisma.notificacao.updateMany({ where: { id: { in: semDispositivo } }, data: { pushStatus: "SEM_DISPOSITIVO" } });
    if (envio.length === 0) return 0;

    const tickets = await carteiro.enviar(envio.map((e) => e.mensagem));
    const resultado = new Map<string, { ok: boolean; temporario: boolean }>();
    const invalidos = new Set<string>();
    await prisma.envioPush.createMany({
      data: envio.map((e, i) => {
        const t = tickets[i];
        const r = resultado.get(e.avisoId) ?? { ok: false, temporario: false };
        if (t.ok) r.ok = true;
        else if (t.tokenInvalido) invalidos.add(e.dispositivoId);
        else r.temporario = true;
        resultado.set(e.avisoId, r);
        return t.ok
          ? { notificacaoId: e.avisoId, dispositivoId: e.dispositivoId, status: "ENVIADO" as const, ticketId: t.ticketId }
          : { notificacaoId: e.avisoId, dispositivoId: e.dispositivoId, status: "ERRO" as const, erro: t.erro.slice(0, 200), verificadoEm: new Date() };
      }),
    });
    if (invalidos.size) await desativar({ id: { in: [...invalidos] } }, "DeviceNotRegistered");

    let enviados = 0;
    for (const a of avisos) {
      const r = resultado.get(a.id);
      if (!r) continue;
      if (r.ok) {
        enviados++;
        await prisma.notificacao.update({ where: { id: a.id }, data: { pushStatus: "ENVIADO", pushEnviadoEm: new Date() } });
      } else if (r.temporario) {
        // Falha passageira (rede, limite de envio): tenta de novo no próximo ciclo
        const tentativas = a.pushTentativas + 1;
        await prisma.notificacao.update({
          where: { id: a.id },
          data: { pushTentativas: tentativas, pushStatus: tentativas >= MAX_TENTATIVAS ? "FALHOU" : "PENDENTE" },
        });
      } else {
        await prisma.notificacao.update({ where: { id: a.id }, data: { pushStatus: "SEM_DISPOSITIVO" } });
      }
    }
    return enviados;
  } finally {
    processando = false;
  }
}

/** Confere os recibos dos envios já aceitos; recibo DeviceNotRegistered desativa o aparelho. */
export async function conferirRecibos() {
  if (!carteiro) return 0;
  const pendentes = await prisma.envioPush.findMany({
    where: { status: "ENVIADO", verificadoEm: null, ticketId: { not: null }, criadoEm: { lte: new Date(Date.now() - env.push.recibosEsperaMs) } },
    select: { id: true, ticketId: true, dispositivoId: true },
    take: 1000,
  });
  if (pendentes.length === 0) return 0;
  const recibos = await carteiro.recibos(pendentes.map((p) => p.ticketId!));
  let conferidos = 0;
  for (const p of pendentes) {
    const r = recibos[p.ticketId!];
    if (!r) continue; // recibo ainda não disponível
    conferidos++;
    await prisma.envioPush.update({
      where: { id: p.id },
      data: r.ok ? { status: "ENTREGUE", verificadoEm: new Date() } : { status: "ERRO", erro: r.erro.slice(0, 200), verificadoEm: new Date() },
    });
    if (!r.ok && r.tokenInvalido) await desativar({ id: p.dispositivoId }, "DeviceNotRegistered");
  }
  return conferidos;
}

/** Liga a fila e a conferência de recibos (junto com a API). */
export function iniciarFilaPush() {
  if (!carteiro) {
    logger.info("Push desligado (PUSH_MODO=desligado): os avisos ficam só no app");
    return;
  }
  // Processo anterior pode ter caído no meio de um envio
  void prisma.notificacao.updateMany({ where: { pushStatus: "ENVIANDO" }, data: { pushStatus: "PENDENTE" } }).catch(() => undefined);
  const executar = (nome: string, tarefa: () => Promise<number>) => async () => {
    try {
      const n = await tarefa();
      if (n > 0) logger.debug({ n }, nome);
    } catch (err) {
      logger.error({ err }, `Falha no push (${nome})`);
    }
  };
  setInterval(executar("push enviado", processarFila), env.push.intervaloMs).unref();
  setInterval(executar("recibos conferidos", conferirRecibos), env.push.recibosIntervaloMs).unref();
  logger.info({ modo: env.push.modo }, "Fila de push ligada");
}

// ---------------------------------------------------------------- Aparelhos

async function desativar(where: Prisma.DispositivoPushWhereInput, motivo: string) {
  await prisma.dispositivoPush.updateMany({ where: { ...where, ativo: true }, data: { ativo: false, motivoDesativacao: motivo } });
}

/** O app registra o aparelho após o login (e sempre que o token mudar). */
export async function registrarDispositivo(usuarioId: string, dados: { token: string; plataforma: PlataformaPush; deviceId?: string }) {
  if (!tokenValido(dados.token)) throw new AppError("PUSH_TOKEN_INVALIDO");
  const dispositivo = await prisma.$transaction(async (tx) => {
    // Mesmo aparelho com token novo (app reinstalado): o token antigo sai
    if (dados.deviceId) {
      await tx.dispositivoPush.updateMany({
        where: { usuarioId, deviceId: dados.deviceId, token: { not: dados.token }, ativo: true },
        data: { ativo: false, motivoDesativacao: "Substituído por token novo" },
      });
    }
    // Token já conhecido (ex.: outro usuário usou este celular antes): passa para quem entrou agora
    return tx.dispositivoPush.upsert({
      where: { token: dados.token },
      update: { usuarioId, plataforma: dados.plataforma, deviceId: dados.deviceId ?? null, ativo: true, motivoDesativacao: null, ultimoUsoEm: new Date() },
      create: { usuarioId, token: dados.token, plataforma: dados.plataforma, deviceId: dados.deviceId ?? null },
      select: { id: true, plataforma: true, ativo: true, criadoEm: true },
    });
  });
  return dispositivo;
}

export async function removerDispositivo(usuarioId: string, token: string) {
  await desativar({ usuarioId, token }, "Removido pelo usuário");
}

/** Sair do aparelho / sessão revogada: o aparelho para de receber push. */
export async function desativarDoAparelho(usuarioId: string, deviceId: string | null, motivo: string) {
  if (deviceId) await desativar({ usuarioId, deviceId }, motivo);
}

export async function desativarTodos(usuarioId: string, motivo: string) {
  await desativar({ usuarioId }, motivo);
}

// ---------------------------------------------------------------- Preferências

export async function preferencias(usuarioId: string) {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { pushDesligado: true } });
  return { desligaveis: DESLIGAVEIS, desligadas: lerDesligadas(usuario.pushDesligado) };
}

export async function salvarPreferencias(usuarioId: string, desligadas: CategoriaNotificacao[]) {
  await prisma.usuario.update({ where: { id: usuarioId }, data: { pushDesligado: [...new Set(desligadas)] } });
  return preferencias(usuarioId);
}
