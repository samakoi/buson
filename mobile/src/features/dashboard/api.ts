import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Relatorio } from "../../types";

export interface ResumoDashboard {
  totalAlunos: number;
  totalMotoristas: number;
  totalOnibus: number;
  totalUniversidades: number;
  viagensAtivas: number;
  onibusEmManutencao: number;
  alunosAtivos: number;
  alunosPendentes: number;
  documentosPendentes: number;
}

export interface Periodo {
  inicio: string;
  fim: string;
}

export const chavesDashboard = {
  resumo: ["dashboard", "resumo"] as const,
  ocupacaoPorUniversidade: ["dashboard", "ocupacao-por-universidade"] as const,
  relatorio: (p: Periodo) => ["dashboard", "relatorio", p.inicio, p.fim] as const,
};

export function useResumo() {
  return useQuery({
    queryKey: chavesDashboard.resumo,
    queryFn: async () => (await api.get<ResumoDashboard>("/dashboard/resumo")).data,
  });
}

export function useOcupacaoPorUniversidade() {
  return useQuery({
    queryKey: chavesDashboard.ocupacaoPorUniversidade,
    queryFn: async () => (await api.get<Record<string, number>>("/dashboard/ocupacao-por-universidade")).data,
  });
}

/** Presença e faltas do período; ao trocar o período, o relatório anterior fica na tela até o novo chegar. */
export function useRelatorio(periodo: Periodo) {
  return useQuery({
    queryKey: chavesDashboard.relatorio(periodo),
    queryFn: async () => (await api.get<Relatorio>("/dashboard/relatorio", { params: periodo })).data,
    placeholderData: keepPreviousData,
  });
}
