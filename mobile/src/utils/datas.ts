// A API troca datas de calendário como "AAAA-MM-DD"; na tela mostramos "DD/MM/AAAA".

export function diaISO(data = new Date()): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return diaISO(new Date(y, m - 1, d + dias));
}

/** "2026-09-25" → "25/09/2026" */
export function formatarDiaBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-09-25" → "sex, 25/09" */
export function formatarDiaCurto(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const semana = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${semana}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "25/09/2026" → "2026-09-25" (ou null se a data não existir) */
export function parseDiaBR(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (data.getMonth() !== Number(m[2]) - 1) return null;
  return diaISO(data);
}

/** Aplica a máscara DD/MM/AAAA enquanto o usuário digita. */
export function mascararDia(texto: string): string {
  const n = texto.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

/** Aplica a máscara HH:MM enquanto o usuário digita. */
export function mascararHora(texto: string): string {
  const n = texto.replace(/\D/g, "").slice(0, 4);
  return n.length <= 2 ? n : `${n.slice(0, 2)}:${n.slice(2)}`;
}

/** "há 5 min", "há 2 h", "ontem", "25/09" */
export function tempoRelativo(dataIso: string): string {
  const minutos = Math.floor((Date.now() - new Date(dataIso).getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return formatarDiaBR(diaISO(new Date(dataIso))).slice(0, 5);
}

/** Minutos até a saída (negativo se já passou). `dia` em AAAA-MM-DD, `horario` em HH:MM. */
export function minutosAte(dia: string, horario: string, agora = new Date()): number {
  const [y, m, d] = dia.slice(0, 10).split("-").map(Number);
  const [hh, mm] = horario.split(":").map(Number);
  return Math.round((new Date(y, m - 1, d, hh, mm).getTime() - agora.getTime()) / 60_000);
}

/** 135 → "2h15", 45 → "45 min" */
export function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** "sexta-feira, 25 de setembro" */
export function dataPorExtenso(data = new Date()): string {
  const texto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---- Dias da semana (0 = domingo … 6 = sábado, igual à API)

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const DIAS_SEMANA_COMPLETOS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"] as const;

/** [1, 3, 5] → "Seg, Qua e Sex" */
export function listarDias(dias: number[]): string {
  const nomes = [...new Set(dias)].sort((a, b) => a - b).map((d) => DIAS_SEMANA[d]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
}
