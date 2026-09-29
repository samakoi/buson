import { Prisma } from "@prisma/client";

/** O que as telas podem ver de um documento (sem o caminho do arquivo). */
export const documentoPublico = {
  id: true,
  tipo: true,
  nomeOriginal: true,
  mimeType: true,
  tamanho: true,
  status: true,
  motivoReprovacao: true,
  analisadoEm: true,
  criadoEm: true,
  analisadoPor: { select: { nome: true } },
} satisfies Prisma.DocumentoSelect;
