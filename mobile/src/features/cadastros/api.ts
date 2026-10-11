import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Motorista, Onibus, Rota, Universidade } from "../../types";

/** Chaves do cache dos cadastros (as mesmas em todas as telas que usam esses dados). */
export const chavesCadastro = {
  universidades: ["universidades"] as const,
  onibus: ["onibus"] as const,
  motoristas: ["motoristas"] as const,
  rotas: ["rotas"] as const,
};

export function useUniversidades() {
  return useQuery({
    queryKey: chavesCadastro.universidades,
    queryFn: async () => (await api.get<Universidade[]>("/universidades")).data,
  });
}

export function useOnibus() {
  return useQuery({ queryKey: chavesCadastro.onibus, queryFn: async () => (await api.get<Onibus[]>("/onibus")).data });
}

export function useMotoristas() {
  return useQuery({ queryKey: chavesCadastro.motoristas, queryFn: async () => (await api.get<Motorista[]>("/motoristas")).data });
}

export function useRotas() {
  return useQuery({ queryKey: chavesCadastro.rotas, queryFn: async () => (await api.get<Rota[]>("/rotas")).data });
}
