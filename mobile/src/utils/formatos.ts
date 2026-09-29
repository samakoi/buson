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

/** 1536 → "1,5 KB"; 2400000 → "2,3 MB" */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** 350 → "350 m"; 2340 → "2,3 km" */
export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}

/** 45 → "há 45 s"; 190 → "há 3 min" */
export function haQuantoTempo(segundos: number): string {
  if (segundos < 60) return `há ${segundos} s`;
  const min = Math.round(segundos / 60);
  return min < 60 ? `há ${min} min` : `há ${Math.round(min / 60)} h`;
}
