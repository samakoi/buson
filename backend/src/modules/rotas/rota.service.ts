import { Prisma, SentidoViagem } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { inicioDoDia, lerDiasSemana, NOMES_DIAS } from "../../utils/datas";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { OPCOES_TX, revisarAlocacoes, travarProgramacoesDasRotas } from "../alocacao/alocacao.service";
import { excluirViagensComAviso } from "../viagens/viagem.service";

/**
 * Rota de uma viagem com os dois trechos:
 *  - IDA: os alunos embarcam nos pontos de embarque (em ordem) e descem nas instituições (em ordem);
 *  - VOLTA: embarcam nas instituições e descem nos pontos.
 * Cada trecho tem origem, destino e paradas próprias. O horário de saída de cada trecho fica na
 * programação (horarioIda / horarioVolta), que é a "viagem" vista pela administração.
 * Excluir a rota é lógico (excluidaEm): as viagens já feitas continuam no histórico.
 */

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export const includeRota = {
  trechos: true,
  pontos: { include: { universidade: true }, orderBy: [{ sentido: "asc" }, { ordem: "asc" }] },
  pontosEmbarque: { include: { pontoEmbarque: true }, orderBy: [{ sentido: "asc" }, { ordem: "asc" }] },
} satisfies Prisma.RotaInclude;

export type RotaCompleta = Prisma.RotaGetPayload<{ include: typeof includeRota }>;

/** Rota no formato da API: os trechos separados e, para clientes antigos, `pontos`/`pontosEmbarque` da ida. */
export function formatarRota(r: RotaCompleta) {
  const trecho = (sentido: SentidoViagem) => {
    const t = r.trechos.find((x) => x.sentido === sentido);
    return {
      sentido,
      origem: t?.origem ?? r.nome,
      destino: t?.destino ?? r.nome,
      instituicoes: r.pontos.filter((p) => p.sentido === sentido),
      pontosEmbarque: r.pontosEmbarque.filter((p) => p.sentido === sentido),
    };
  };
  const ida = trecho("IDA");
  return {
    id: r.id,
    nome: r.nome,
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
    pontos: ida.instituicoes,
    pontosEmbarque: ida.pontosEmbarque,
    trechos: { ida, volta: trecho("VOLTA") },
  };
}

/** Resumo legível para a auditoria. */
function descrever(r: RotaCompleta) {
  const f = formatarRota(r);
  const t = (x: ReturnType<typeof formatarRota>["trechos"]["ida"]) => ({
    origem: x.origem,
    destino: x.destino,
    instituicoes: x.instituicoes.map((p) => p.universidade.nome),
    pontos: x.pontosEmbarque.map((p) => p.pontoEmbarque.nome),
  });
  return { nome: f.nome, ida: t(f.trechos.ida), volta: t(f.trechos.volta) };
}

// ---------------------------------------------------------------- Validação

const semRepetir = (ids: string[]) => new Set(ids).size === ids.length;
const local = (campo: string) =>
  z
    .string()
    .trim()
    .min(2, `Informe ${campo} (ao menos 2 letras).`)
    .max(80, `${campo[0].toUpperCase()}${campo.slice(2)} pode ter no máximo 80 caracteres.`);

export const trechoSchema = z
  .object({
    origem: local("a origem"),
    destino: local("o destino"),
    // IDA: onde os alunos descem; VOLTA: onde embarcam. Na ordem do trajeto.
    universidadeIds: z
      .array(z.string().uuid("Instituição inválida."))
      .min(1, "Escolha ao menos uma instituição em cada trecho.")
      .refine(semRepetir, "A mesma instituição não pode aparecer duas vezes no mesmo trecho."),
    // IDA: onde os alunos embarcam; VOLTA: onde descem. Opcional, na ordem do trajeto.
    pontosEmbarqueIds: z
      .array(z.string().uuid("Ponto inválido."))
      .refine(semRepetir, "O mesmo ponto não pode aparecer duas vezes no mesmo trecho.")
      .default([]),
  })
  .strict();

export const nomeRota = z.string().trim().min(2, "Informe o nome da viagem.").max(120, "O nome pode ter no máximo 120 caracteres.");

/** Rota completa (nova): ida e volta. O nome é opcional (padrão "origem ↔ destino" da ida). */
export const rotaSchema = z.object({ nome: nomeRota.optional(), ida: trechoSchema, volta: trechoSchema }).strict();
/** Edição: só o que mudou; `versao` = atualizadoEm lido pela tela (evita sobrescrever outra pessoa). */
export const rotaEdicaoSchema = z
  .object({
    nome: nomeRota.optional(),
    ida: trechoSchema.optional(),
    volta: trechoSchema.optional(),
    versao: z.string().datetime("Versão inválida.").optional(),
  })
  .strict();

/** Formato antigo (uma lista para os dois sentidos), ainda enviado por versões anteriores do app. */
export const rotaLegadaSchema = z
  .object({
    nome: nomeRota,
    universidadeIds: z
      .array(z.string().uuid())
      .min(1, "Selecione ao menos uma universidade.")
      .refine(semRepetir, "A mesma universidade não pode aparecer duas vezes."),
    pontosEmbarqueIds: z.array(z.string().uuid()).refine(semRepetir, "O mesmo ponto não pode aparecer duas vezes.").optional(),
  })
  .strict();

export type EntradaTrecho = z.output<typeof trechoSchema>;
export type EntradaRota = z.output<typeof rotaSchema>;
export type EdicaoRota = z.output<typeof rotaEdicaoSchema>;

const nomePadrao = (ida: { origem: string; destino: string }) => `${ida.origem} ↔ ${ida.destino}`.slice(0, 120);

/** Converte o formato antigo: a mesma lista nos dois sentidos (pontos invertidos na volta). */
export async function deLegado(db: Db, legado: Partial<z.output<typeof rotaLegadaSchema>>, atual?: RotaCompleta): Promise<EdicaoRota> {
  const atualF = atual ? formatarRota(atual) : null;
  const universidadeIds = legado.universidadeIds ?? atualF?.trechos.ida.instituicoes.map((p) => p.universidadeId);
  const pontosEmbarqueIds = legado.pontosEmbarqueIds ?? atualF?.trechos.ida.pontosEmbarque.map((p) => p.pontoEmbarqueId) ?? [];
  if (!universidadeIds) return { nome: legado.nome };
  if (!legado.universidadeIds && !legado.pontosEmbarqueIds) return { nome: legado.nome };

  let origem = atualF?.trechos.ida.origem;
  let destino = atualF?.trechos.ida.destino;
  if (!atualF) {
    const [primeiroPonto, ultimaInstituicao] = await Promise.all([
      pontosEmbarqueIds[0] ? db.pontoEmbarque.findUnique({ where: { id: pontosEmbarqueIds[0] }, select: { nome: true } }) : null,
      db.universidade.findUnique({ where: { id: universidadeIds[universidadeIds.length - 1] }, select: { nome: true } }),
    ]);
    origem = (primeiroPonto?.nome ?? legado.nome ?? "Origem").slice(0, 80);
    destino = (ultimaInstituicao?.nome ?? "Instituições").slice(0, 80);
  }
  return {
    nome: legado.nome,
    ida: { origem: origem!, destino: destino!, universidadeIds, pontosEmbarqueIds },
    volta: {
      origem: atualF?.trechos.volta.origem ?? destino!,
      destino: atualF?.trechos.volta.destino ?? origem!,
      universidadeIds,
      pontosEmbarqueIds: [...pontosEmbarqueIds].reverse(),
    },
  };
}

/** Instituições existentes e pontos de embarque ativos: nada de referência a cadastro inexistente. */
async function conferirReferencias(tx: Tx, trechos: (EntradaTrecho | undefined)[]) {
  const universidades = [...new Set(trechos.flatMap((t) => t?.universidadeIds ?? []))];
  const pontos = [...new Set(trechos.flatMap((t) => t?.pontosEmbarqueIds ?? []))];
  const [u, p] = await Promise.all([
    universidades.length ? tx.universidade.count({ where: { id: { in: universidades } } }) : 0,
    pontos.length ? tx.pontoEmbarque.count({ where: { id: { in: pontos }, ativo: true } }) : 0,
  ]);
  if (u !== universidades.length) throw new AppError("UNIVERSIDADE_NAO_ENCONTRADA");
  if (p !== pontos.length) throw new AppError("PONTO_EMBARQUE_NAO_ENCONTRADO");
}

const paradasDoTrecho = (sentido: SentidoViagem, t: EntradaTrecho) => ({
  instituicoes: t.universidadeIds.map((universidadeId, i) => ({ universidadeId, sentido, ordem: i + 1 })),
  pontos: t.pontosEmbarqueIds.map((pontoEmbarqueId, i) => ({ pontoEmbarqueId, sentido, ordem: i + 1 })),
});

// ---------------------------------------------------------------- Criar / editar

export async function criarRota(tx: Tx, entrada: EntradaRota, usuarioId: string) {
  await conferirReferencias(tx, [entrada.ida, entrada.volta]);
  const ida = paradasDoTrecho("IDA", entrada.ida);
  const volta = paradasDoTrecho("VOLTA", entrada.volta);
  const rota = await tx.rota.create({
    data: {
      nome: entrada.nome || nomePadrao(entrada.ida),
      trechos: {
        create: [
          { sentido: "IDA", origem: entrada.ida.origem, destino: entrada.ida.destino },
          { sentido: "VOLTA", origem: entrada.volta.origem, destino: entrada.volta.destino },
        ],
      },
      pontos: { create: [...ida.instituicoes, ...volta.instituicoes] },
      pontosEmbarque: { create: [...ida.pontos, ...volta.pontos] },
    },
    include: includeRota,
  });
  await registrarAuditoria(tx, {
    usuarioId,
    acao: "ROTA_CADASTRADA",
    entidade: "Rota",
    entidadeId: rota.id,
    valorNovo: descrever(rota),
  });
  return rota;
}

/**
 * Edita a rota (nome e/ou trechos). Cada trecho enviado substitui as paradas daquele sentido;
 * o trecho em si é atualizado no lugar (único por rota + sentido), então salvar várias vezes
 * nunca duplica nada. Não revê as alocações: quem chama decide (revisarAlocacoes).
 */
export async function atualizarRota(tx: Tx, rotaId: string, edicao: EdicaoRota, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM rotas WHERE id = ${rotaId} FOR UPDATE`;
  const antes = await tx.rota.findFirst({ where: { id: rotaId, excluidaEm: null }, include: includeRota });
  if (!antes) throw new AppError("ROTA_NAO_CADASTRADA");
  if (edicao.versao && new Date(edicao.versao).getTime() !== antes.atualizadoEm.getTime()) throw new AppError("EDICAO_CONFLITANTE");
  await conferirReferencias(tx, [edicao.ida, edicao.volta]);

  for (const [sentido, t] of [
    ["IDA", edicao.ida],
    ["VOLTA", edicao.volta],
  ] as const) {
    if (!t) continue;
    await tx.trechoRota.upsert({
      where: { rotaId_sentido: { rotaId, sentido } },
      update: { origem: t.origem, destino: t.destino },
      create: { rotaId, sentido, origem: t.origem, destino: t.destino },
    });
    const paradas = paradasDoTrecho(sentido, t);
    await tx.pontoRota.deleteMany({ where: { rotaId, sentido } });
    await tx.pontoRota.createMany({ data: paradas.instituicoes.map((p) => ({ ...p, rotaId })) });
    await tx.rotaPontoEmbarque.deleteMany({ where: { rotaId, sentido } });
    await tx.rotaPontoEmbarque.createMany({ data: paradas.pontos.map((p) => ({ ...p, rotaId })) });
  }
  // Sempre atualiza: atualizadoEm muda e uma edição concorrente com a versão antiga é recusada
  await tx.rota.update({ where: { id: rotaId }, data: { nome: edicao.nome ?? antes.nome } });

  const depois = await tx.rota.findUniqueOrThrow({ where: { id: rotaId }, include: includeRota });
  const [a, d] = [descrever(antes), descrever(depois)];
  if (JSON.stringify(a) !== JSON.stringify(d)) {
    await registrarAuditoria(tx, {
      usuarioId,
      acao: "ROTA_ALTERADA",
      entidade: "Rota",
      entidadeId: rotaId,
      valorAnterior: a,
      valorNovo: d,
    });
  }
  return depois;
}

// ---------------------------------------------------------------- Exclusão

/** O que a exclusão afeta (a tela mostra antes de confirmar). */
export async function impactoExclusao(db: Db, rotaId: string) {
  const rota = await db.rota.findFirst({ where: { id: rotaId, excluidaEm: null }, select: { id: true, nome: true } });
  if (!rota) throw new AppError("ROTA_NAO_CADASTRADA");
  const futuras = { rotaId, status: "AGUARDANDO" as const, data: { gte: inicioDoDia() } };
  const [alunos, viagensFuturas, reservasFuturas, viagensEmAndamento, viagensNoHistorico, programacoes] = await Promise.all([
    db.alocacaoAluno.findMany({ where: { rotaId, ativo: true }, distinct: ["alunoId"], select: { alunoId: true } }),
    db.viagem.count({ where: futuras }),
    db.checkin.count({ where: { viagem: futuras, status: { in: ["PROGRAMADO", "CONFIRMADO", "ESPERA"] } } }),
    db.viagem.count({ where: { rotaId, status: "EM_ANDAMENTO" } }),
    db.viagem.count({ where: { rotaId, NOT: futuras } }),
    db.programacao.findMany({ where: { rotaId }, select: { ativa: true, diasSemana: true, horarioIda: true, horarioVolta: true } }),
  ]);
  const vinculos = alunos.length + viagensFuturas + reservasFuturas + programacoes.length;
  return {
    rota,
    alunosComDiasFixos: alunos.length,
    viagensFuturas,
    reservasFuturas,
    viagensEmAndamento,
    viagensNoHistorico,
    programacoes: programacoes.length,
    temVinculos: vinculos > 0,
    programacaoResumo: programacoes.map((p) => ({
      ativa: p.ativa,
      dias: lerDiasSemana(p.diasSemana).map((d) => NOMES_DIAS[d]),
      ida: p.horarioIda,
      volta: p.horarioVolta,
    })),
  };
}

/**
 * Exclui a rota mesmo com alunos vinculados, sem corromper nada:
 *  1. viagens futuras que ainda não começaram (programadas ou avulsas) são canceladas, com aviso
 *     a quem tinha vaga ou estava na espera;
 *  2. a programação da rota é encerrada (as viagens já feitas ficam no histórico, sem ela);
 *  3. a rota recebe excluidaEm e some das listas e das novas escolhas;
 *  4. os dias fixos dos alunos nela são desativados e cada aluno é avisado (regra existente);
 *  5. as paradas são desvinculadas (instituições e pontos continuam cadastrados).
 * Presenças, faltas, embarques, posições de GPS e auditoria das viagens feitas não são tocados.
 * Viagem em andamento bloqueia: não dá para cancelar um ônibus na rua.
 */
export async function excluirRota(rotaId: string, usuarioId: string, confirmarVinculos: boolean) {
  return prisma.$transaction(async (tx) => {
    // Mesma ordem de travas da escolha de dias (programações, depois a rota): sem deadlock
    await travarProgramacoesDasRotas(tx, [rotaId]);
    await tx.$queryRaw`SELECT id FROM rotas WHERE id = ${rotaId} FOR UPDATE`;
    const impacto = await impactoExclusao(tx, rotaId);
    if (impacto.viagensEmAndamento > 0) throw new AppError("ROTA_COM_VIAGEM_EM_ANDAMENTO");
    if (impacto.temVinculos && !confirmarVinculos) {
      throw new AppError("ROTA_COM_VINCULOS", undefined, {
        alunosComDiasFixos: impacto.alunosComDiasFixos,
        viagensFuturas: impacto.viagensFuturas,
        reservasFuturas: impacto.reservasFuturas,
        programacoes: impacto.programacoes,
      });
    }
    const antes = await tx.rota.findUniqueOrThrow({ where: { id: rotaId }, include: includeRota });

    const futuras = await tx.viagem.findMany({
      where: { rotaId, status: "AGUARDANDO", data: { gte: inicioDoDia() } },
      select: { id: true },
    });
    await excluirViagensComAviso(
      tx,
      futuras.map((v) => v.id),
      `a viagem ${antes.nome} foi encerrada pela administração.`
    );
    await tx.programacao.deleteMany({ where: { rotaId } });
    await tx.rota.update({ where: { id: rotaId }, data: { excluidaEm: new Date() } });
    // Sem programação, os dias fixos nela deixam de valer: desativa e avisa cada aluno
    await revisarAlocacoes(tx, { rotaId }, usuarioId);
    await tx.pontoRota.deleteMany({ where: { rotaId } });
    await tx.rotaPontoEmbarque.deleteMany({ where: { rotaId } });

    await registrarAuditoria(tx, {
      usuarioId,
      acao: "ROTA_REMOVIDA",
      entidade: "Rota",
      entidadeId: rotaId,
      valorAnterior: { ...descrever(antes), programacoes: impacto.programacaoResumo },
      detalhes: {
        viagensCanceladas: futuras.length,
        reservasCanceladas: impacto.reservasFuturas,
        alunosComDiasLiberados: impacto.alunosComDiasFixos,
        viagensPreservadasNoHistorico: impacto.viagensNoHistorico,
      },
    });
    return {
      viagensCanceladas: futuras.length,
      reservasCanceladas: impacto.reservasFuturas,
      alunosAvisados: impacto.alunosComDiasFixos,
      viagensNoHistorico: impacto.viagensNoHistorico,
    };
  }, OPCOES_TX);
}
