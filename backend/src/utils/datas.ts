// Datas "de calendário" (sem hora) usam o fuso do servidor, no formato YYYY-MM-DD.

import { AppError } from "../middlewares/errorHandler";

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Converte "YYYY-MM-DD" para meia-noite local desse dia. */
export function parseDia(dia: string): Date {
  const m = FORMATO_DIA.exec(dia);
  const data = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(NaN);
  if (!m || data.getMonth() !== Number(m[2]) - 1) throw new AppError(`Data inválida: ${dia}.`, 400);
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
