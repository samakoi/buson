import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { criarEstilos } from "../theme/TemaProvider";
import { elevacao } from "../theme/tokens";

/** Superfície padrão. `destaque` = cartão principal da tela (fundo marinho). */
export function Card({
  children,
  variante = "padrao",
  semPadding,
  style,
}: {
  children: React.ReactNode;
  variante?: "padrao" | "destaque";
  semPadding?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useEstilos();
  return <View style={[s.base, variante === "destaque" ? s.destaque : s.padrao, semPadding && s.semPadding, style]}>{children}</View>;
}

const useEstilos = criarEstilos((t) => ({
  base: { borderRadius: t.raio.lg, padding: t.espaco.lg, marginBottom: t.espaco.md },
  padrao: { backgroundColor: t.cores.superficie, ...elevacao(t.cores, t.escuro) },
  destaque: { backgroundColor: t.cores.destaque, ...elevacao(t.cores, t.escuro, 2) },
  semPadding: { padding: 0, overflow: "hidden" },
}));
