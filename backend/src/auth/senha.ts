import { z } from "zod";

/**
 * Regra de senha forte, exigida ao CRIAR uma senha (cadastro do aluno, motorista, administrador).
 * O login continua aceitando as senhas já existentes. O app mostra a mesma lista enquanto a pessoa
 * digita (mobile/src/utils/senha.ts): mantenha as duas iguais.
 */
export const SENHA_MINIMO = 8;
// O bcrypt só considera os primeiros 72 bytes: acima disso, o resto da senha seria ignorado
export const SENHA_MAXIMO = 72;

export const REQUISITOS_SENHA = [
  { texto: `pelo menos ${SENHA_MINIMO} caracteres`, ok: (s: string) => s.length >= SENHA_MINIMO },
  { texto: "uma letra maiúscula", ok: (s: string) => /\p{Lu}/u.test(s) },
  { texto: "uma letra minúscula", ok: (s: string) => /\p{Ll}/u.test(s) },
  { texto: "um número", ok: (s: string) => /\d/.test(s) },
  { texto: "um caractere especial (ex.: ! @ # $ %)", ok: (s: string) => /[^\p{L}\p{N}\s]/u.test(s) },
] as const;

/** Itens da regra que a senha ainda não cumpre (vazio = senha aceita). */
export function requisitosFaltando(senha: string): string[] {
  return REQUISITOS_SENHA.filter((r) => !r.ok(senha)).map((r) => r.texto);
}

/** Schema zod da senha nova; a mensagem lista o que falta. */
export const senhaForte = z
  .string()
  .max(SENHA_MAXIMO, `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`)
  .superRefine((senha, ctx) => {
    const faltando = requisitosFaltando(senha);
    if (faltando.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `A senha precisa ter ${juntar(faltando)}.` });
  });

function juntar(itens: string[]) {
  return itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0];
}
