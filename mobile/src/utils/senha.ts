/**
 * Regra de senha forte para senhas NOVAS (cadastro do aluno e senha inicial do motorista).
 * É a mesma da API (backend/src/auth/senha.ts), que é quem decide de fato: mantenha as duas iguais.
 */
export const SENHA_MINIMO = 8;

export const REQUISITOS_SENHA = [
  { texto: `Pelo menos ${SENHA_MINIMO} caracteres`, ok: (s: string) => s.length >= SENHA_MINIMO },
  { texto: "Uma letra maiúscula", ok: (s: string) => /\p{Lu}/u.test(s) },
  { texto: "Uma letra minúscula", ok: (s: string) => /\p{Ll}/u.test(s) },
  { texto: "Um número", ok: (s: string) => /\d/.test(s) },
  { texto: "Um caractere especial (ex.: ! @ # $ %)", ok: (s: string) => /[^\p{L}\p{N}\s]/u.test(s) },
] as const;

export function senhaForte(senha: string): boolean {
  return REQUISITOS_SENHA.every((r) => r.ok(senha));
}
