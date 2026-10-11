import { diaISO, somarDias } from "./datas";

/** Períodos prontos dos filtros (relatório de presença, histórico de viagens). */
export type PresetPeriodo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "personalizado";

export const PRESETS_PERIODO: { valor: PresetPeriodo; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "ontem", rotulo: "Ontem" },
  { valor: "7d", rotulo: "7 dias" },
  { valor: "30d", rotulo: "30 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "personalizado", rotulo: "Personalizado" },
];

export interface Periodo {
  inicio: string; // AAAA-MM-DD
  fim: string;
}

export function periodoDoPreset(preset: Exclude<PresetPeriodo, "personalizado">, hoje = diaISO()): Periodo {
  switch (preset) {
    case "hoje":
      return { inicio: hoje, fim: hoje };
    case "ontem":
      return { inicio: somarDias(hoje, -1), fim: somarDias(hoje, -1) };
    case "7d":
      return { inicio: somarDias(hoje, -6), fim: hoje };
    case "30d":
      return { inicio: somarDias(hoje, -29), fim: hoje };
    case "mes":
      return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };
  }
}
