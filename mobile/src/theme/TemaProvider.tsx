import React, { createContext, useContext, useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { espaco, Paleta, paletaClara, paletaEscura, raio, tipo } from "./tokens";

export interface Tema {
  cores: Paleta;
  escuro: boolean;
  tipo: typeof tipo;
  espaco: typeof espaco;
  raio: typeof raio;
}

const temaClaro: Tema = { cores: paletaClara, escuro: false, tipo, espaco, raio };
const temaEscuro: Tema = { cores: paletaEscura, escuro: true, tipo, espaco, raio };

const TemaContext = createContext<Tema>(temaClaro);

/** Segue o modo claro/escuro do aparelho. */
export function TemaProvider({ children }: { children: React.ReactNode }) {
  const esquema = useColorScheme();
  const tema = esquema === "dark" ? temaEscuro : temaClaro;
  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>;
}

export const useTema = () => useContext(TemaContext);

/**
 * Cria um hook de estilos que depende do tema. Os StyleSheets são criados uma
 * vez por modo (claro/escuro) e reaproveitados.
 *
 *   const useEstilos = criarEstilos((t) => ({ titulo: { color: t.cores.texto } }));
 *   const s = useEstilos();
 */
export function criarEstilos<T extends StyleSheet.NamedStyles<T>>(fabrica: (tema: Tema) => T) {
  const cache = new Map<boolean, T>();
  return function useEstilos(): T {
    const tema = useTema();
    return useMemo(() => {
      let estilos = cache.get(tema.escuro);
      if (!estilos) {
        estilos = StyleSheet.create(fabrica(tema));
        cache.set(tema.escuro, estilos);
      }
      return estilos;
    }, [tema]);
  };
}
