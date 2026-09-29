// Datas "de calendário" (sem hora) usam o fuso do servidor, no formato YYYY-MM-DD.

import { AppError } from "../errors/AppError";

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Converte "YYYY-MM-DD" para meia-noite local desse dia. */
export function parseDia(dia: string): Date {
  const m = FORMATO_DIA.exec(dia);
  const data = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(NaN);
  if (!m || data.getMonth() !== Number(m[2]) - 1) throw new AppError("DATA_INVALIDA", `Data inválida: ${dia}.`);
  return data;
}

/** Formata uma data como "YYYY-MM-DD" no fuso local. */
export function formatarDia(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function inicioDoDia(data = new Date()): Date {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

export function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

/** Intervalo [início, fim) cobrindo os dias de `de` até `ate` (inclusive). */
export function intervaloDeDias(de: Date, ate: Date = de) {
  return { gte: inicioDoDia(de), lt: somarDias(inicioDoDia(ate), 1) };
}

export function intervaloDeHoje() {
  return intervaloDeDias(new Date());
}

// ---- Dias da semana (0 = domingo … 6 = sábado, como Date.getDay())

export const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** "Seg, Qua e Sex" */
export function nomesDosDias(dias: number[]): string {
  const nomes = [...new Set(dias)].sort((a, b) => a - b).map((d) => NOMES_DIAS[d]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes.join("");
}

/** Lê a coluna JSON `diasSemana` garantindo uma lista ordenada de dias válidos. */
export function lerDiasSemana(valor: unknown): number[] {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
}

/** O dia `dia` no horário "HH:MM". */
export function comHorario(dia: Date, horario: string): Date {
  const [hora, minuto] = horario.split(":").map(Number);
  const data = inicioDoDia(dia);
  data.setHours(hora, minuto);
  return data;
}

/** "28/09" */
export function diaMes(data: Date): string {
  return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
}
