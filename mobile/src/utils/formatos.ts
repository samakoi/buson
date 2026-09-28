/** Máscara de telefone brasileiro enquanto digita: (99) 98888-7777 */
export function mascararTelefone(texto: string): string {
  const n = texto.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n.length ? `(${n}` : "";
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

/** Formata o telefone guardado só com dígitos. */
export function formatarTelefone(digitos: string | null | undefined): string {
  return digitos ? mascararTelefone(digitos) : "—";
}
