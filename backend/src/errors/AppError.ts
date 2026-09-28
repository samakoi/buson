import { CodigoErro, ERROS } from "./catalogo";

/**
 * Erro de negócio. O status HTTP e a mensagem padrão vêm do catálogo; a
 * mensagem pode ser detalhada (ex.: incluir a placa ou o nome do aluno),
 * mas o código é sempre o mesmo para a mesma situação.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    public readonly codigo: CodigoErro,
    mensagem?: string,
    public readonly detalhes?: unknown
  ) {
    super(mensagem ?? ERROS[codigo].mensagem);
    this.status = ERROS[codigo].status;
  }
}
