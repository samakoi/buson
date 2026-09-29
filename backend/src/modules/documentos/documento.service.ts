import { randomUUID } from "node:crypto";
import { Prisma, StatusDocumento, TipoDocumento } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../errors/AppError";
import { temPermissao } from "../../auth/permissoes";
import { JwtPayload } from "../../utils/jwt";
import { armazenamento } from "../../storage/armazenamento";
import { detectarFormato, nomeSeguro, TAMANHO_MAXIMO } from "../../storage/formatos";
import { assinarLink, verificarLink } from "../../utils/linkAssinado";
import { registrarAuditoria } from "../auditoria/auditoria.service";
import { notificarAdmins, notificarAluno } from "../notificacoes/notificacao.service";
import { OPCOES_TX } from "../alocacao/alocacao.service";
import { alterarStatusNaTransacao } from "../alunos/aluno.service";
import { documentoPublico } from "./documento.select";

/**
 * Documentos do aluno (comprovante/declaração de matrícula):
 *  PENDENTE → (admin abre) EM_ANALISE → APROVADO | REPROVADO (motivo obrigatório)
 *  Reprovado → o aluno envia outro (o histórico fica). Aprovar ativa a conta pendente.
 * O arquivo fica no armazenamento (fora da pasta pública); o banco guarda só os metadados.
 */

export { TAMANHO_MAXIMO };

const AGUARDANDO: StatusDocumento[] = ["PENDENTE", "EM_ANALISE"];

async function alunoDoUsuario(usuarioId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { usuarioId }, select: { id: true, statusConta: true, usuario: { select: { nome: true } } } });
  if (!aluno) throw new AppError("PERFIL_ALUNO_NAO_ENCONTRADO");
  return aluno;
}


export async function enviar(usuarioId: string, arquivo: Express.Multer.File | undefined, tipo: TipoDocumento) {
  const aluno = await alunoDoUsuario(usuarioId);
  if (aluno.statusConta === "INATIVO") throw new AppError("CONTA_INATIVA");
  if (!arquivo || arquivo.size === 0) throw new AppError("ARQUIVO_OBRIGATORIO");
  const formato = detectarFormato(arquivo.buffer);
  if (!formato) throw new AppError("TIPO_ARQUIVO_INVALIDO");

  const chave = `documentos/${aluno.id}/${randomUUID()}.${formato.extensao}`;
  await armazenamento.salvar(chave, arquivo.buffer);
  try {
    return await prisma.$transaction(async (tx) => {
      // Um envio por vez por aluno: dois envios simultâneos não criam dois pendentes
      await tx.$queryRaw`SELECT id FROM alunos WHERE id = ${aluno.id} FOR UPDATE`;
      const aguardando = await tx.documento.count({ where: { alunoId: aluno.id, status: { in: AGUARDANDO } } });
      if (aguardando > 0) throw new AppError("DOCUMENTO_AGUARDANDO_ANALISE");

      const documento = await tx.documento.create({
        data: {
          alunoId: aluno.id,
          tipo,
          arquivo: chave,
          nomeOriginal: nomeSeguro(arquivo.originalname, formato.extensao),
          mimeType: formato.mimeType,
          tamanho: arquivo.size,
        },
        select: documentoPublico,
      });
      await registrarAuditoria(tx, {
        usuarioId,
        acao: "DOCUMENTO_ENVIADO",
        entidade: "Aluno",
        entidadeId: aluno.id,
        detalhes: { documentoId: documento.id, arquivo: documento.nomeOriginal },
        valorNovo: { documento: "PENDENTE" },
      });
      await notificarAdmins(tx, { mensagem: `${aluno.usuario.nome} enviou um documento de matrícula para análise.`, categoria: "DOCUMENTO" });
      return documento;
    }, OPCOES_TX);
  } catch (err) {
    await armazenamento.remover(chave); // o registro não foi criado: não deixa arquivo órfão
    throw err;
  }
}

export async function meusDocumentos(usuarioId: string) {
  const aluno = await alunoDoUsuario(usuarioId);
  return prisma.documento.findMany({ where: { alunoId: aluno.id }, select: documentoPublico, orderBy: { criadoEm: "desc" } });
}

export interface FiltroDocumentos {
  status?: StatusDocumento;
  busca?: string;
  pagina: number;
  porPagina: number;
}

/** Fila do admin: documentos com o aluno, filtros e as contagens por status. */
export async function listar(f: FiltroDocumentos) {
  const busca = f.busca?.trim();
  const whereBusca: Prisma.DocumentoWhereInput = busca
    ? {
        aluno: {
          OR: [
            { usuario: { nome: { contains: busca } } },
            { matricula: { contains: busca } },
            { universidade: { nome: { contains: busca } } },
          ],
        },
      }
    : {};
  const where = { ...whereBusca, ...(f.status && { status: f.status }) };
  const [itens, total, porStatus] = await Promise.all([
    prisma.documento.findMany({
      where,
      select: {
        ...documentoPublico,
        aluno: { select: { id: true, matricula: true, statusConta: true, usuario: { select: { nome: true } }, universidade: { select: { nome: true } } } },
      },
      // Fila: os mais antigos primeiro (quem espera há mais tempo)
      orderBy: { criadoEm: f.status && !AGUARDANDO.includes(f.status) ? "desc" : "asc" },
      skip: (f.pagina - 1) * f.porPagina,
      take: f.porPagina,
    }),
    prisma.documento.count({ where }),
    prisma.documento.groupBy({ by: ["status"], where: whereBusca, _count: { _all: true } }),
  ]);
  const contagens: Record<StatusDocumento, number> = { PENDENTE: 0, EM_ANALISE: 0, APROVADO: 0, REPROVADO: 0 };
  for (const g of porStatus) contagens[g.status] = g._count._all;
  return { itens, total, pagina: f.pagina, porPagina: f.porPagina, contagens };
}

// ---------------------------------------------------------------- Link temporário

/**
 * Link de 5 minutos para abrir o arquivo no navegador/visualizador (que não mandam o
 * token de login). O dono ou a administração pedem o link; abrir um documento
 * pendente como admin o coloca "em análise".
 */
export async function gerarLink(documentoId: string, usuario: JwtPayload) {
  const documento = await prisma.documento.findUnique({
    where: { id: documentoId },
    select: { id: true, status: true, alunoId: true, mimeType: true, nomeOriginal: true, aluno: { select: { usuarioId: true } } },
  });
  const dono = documento?.aluno.usuarioId === usuario.sub;
  // Documento de outro aluno responde "não encontrado" (não revela que existe)
  if (!documento || (!dono && !temPermissao(usuario.papel, "alunos:ler"))) throw new AppError("DOCUMENTO_NAO_ENCONTRADO");

  if (!dono && documento.status === "PENDENTE" && temPermissao(usuario.papel, "alunos:gerenciar")) {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.documento.updateMany({ where: { id: documento.id, status: "PENDENTE" }, data: { status: "EM_ANALISE" } });
      if (count === 0) return; // outro admin abriu ao mesmo tempo
      await registrarAuditoria(tx, {
        usuarioId: usuario.sub,
        acao: "DOCUMENTO_EM_ANALISE",
        entidade: "Aluno",
        entidadeId: documento.alunoId,
        detalhes: { documentoId: documento.id },
        valorAnterior: { documento: "PENDENTE" },
        valorNovo: { documento: "EM_ANALISE" },
      });
      await notificarAluno(tx, documento.alunoId, { mensagem: "Seu documento de matrícula está em análise.", categoria: "DOCUMENTO" });
    });
  }

  const link = assinarLink("documento", documento.id);
  return {
    caminho: `/documentos/${documento.id}/arquivo?${link.query}`,
    expiraEm: link.expiraEm,
    mimeType: documento.mimeType,
    nomeOriginal: documento.nomeOriginal,
  };
}

export async function abrirArquivo(documentoId: string, expira: number, recebida: string) {
  verificarLink("documento", documentoId, expira, recebida);

  const documento = await prisma.documento.findUnique({ where: { id: documentoId }, select: { arquivo: true, mimeType: true, nomeOriginal: true } });
  if (!documento) throw new AppError("DOCUMENTO_NAO_ENCONTRADO");
  return { ...(await armazenamento.abrir(documento.arquivo)), mimeType: documento.mimeType, nomeOriginal: documento.nomeOriginal };
}

// ---------------------------------------------------------------- Análise

async function travarParaAnalise(tx: Prisma.TransactionClient, documentoId: string) {
  await tx.$queryRaw`SELECT id FROM documentos WHERE id = ${documentoId} FOR UPDATE`;
  const documento = await tx.documento.findUnique({ where: { id: documentoId }, select: { id: true, status: true, alunoId: true, nomeOriginal: true } });
  if (!documento) throw new AppError("DOCUMENTO_NAO_ENCONTRADO");
  if (!AGUARDANDO.includes(documento.status)) throw new AppError("DOCUMENTO_JA_ANALISADO");
  return documento;
}

/** Aprova o documento; se a conta do aluno estava pendente, ela é ativada na mesma transação. */
export async function aprovar(documentoId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const documento = await travarParaAnalise(tx, documentoId);
    await tx.documento.update({ where: { id: documento.id }, data: { status: "APROVADO", analisadoPorId: adminId, analisadoEm: new Date(), motivoReprovacao: null } });
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: "DOCUMENTO_APROVADO",
      entidade: "Aluno",
      entidadeId: documento.alunoId,
      detalhes: { documentoId: documento.id, arquivo: documento.nomeOriginal },
      valorAnterior: { documento: documento.status },
      valorNovo: { documento: "APROVADO" },
    });
    await notificarAluno(tx, documento.alunoId, { mensagem: "Seu documento de matrícula foi aprovado.", categoria: "DOCUMENTO" });

    const aluno = await tx.aluno.findUniqueOrThrow({ where: { id: documento.alunoId }, select: { statusConta: true } });
    if (aluno.statusConta === "PENDENTE") await alterarStatusNaTransacao(tx, documento.alunoId, "ATIVO", "Documento de matrícula aprovado", adminId);
    return tx.documento.findUniqueOrThrow({ where: { id: documento.id }, select: documentoPublico });
  }, OPCOES_TX);
}

export async function reprovar(documentoId: string, adminId: string, motivo: string) {
  return prisma.$transaction(async (tx) => {
    const documento = await travarParaAnalise(tx, documentoId);
    await tx.documento.update({ where: { id: documento.id }, data: { status: "REPROVADO", motivoReprovacao: motivo, analisadoPorId: adminId, analisadoEm: new Date() } });
    await registrarAuditoria(tx, {
      usuarioId: adminId,
      acao: "DOCUMENTO_REPROVADO",
      entidade: "Aluno",
      entidadeId: documento.alunoId,
      detalhes: { documentoId: documento.id, arquivo: documento.nomeOriginal, motivo },
      valorAnterior: { documento: documento.status },
      valorNovo: { documento: "REPROVADO" },
    });
    await notificarAluno(tx, documento.alunoId, {
      mensagem: `Seu documento de matrícula foi reprovado: ${motivo}. Envie um novo em Perfil › Documentação.`,
      categoria: "DOCUMENTO",
    });
    return tx.documento.findUniqueOrThrow({ where: { id: documento.id }, select: documentoPublico });
  });
}
