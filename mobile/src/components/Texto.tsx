import React from "react";
import { Text, TextProps } from "react-native";
import { useTema } from "../theme/TemaProvider";
import { Paleta, VarianteTexto } from "../theme/tokens";

interface Props extends TextProps {
  variante?: VarianteTexto;
  /** Nome de uma cor da paleta (ex.: "textoSuave") ou uma cor já resolvida. */
  cor?: keyof Paleta | (string & {});
  alinhar?: "left" | "center" | "right";
}

/** Texto do app: sempre usa a escala tipográfica e as cores do tema. */
export function Texto({ variante = "corpo", cor = "texto", alinhar, style, ...props }: Props) {
  const { cores, tipo } = useTema();
  const corFinal = cor in cores ? cores[cor as keyof Paleta] : cor;
  return <Text style={[tipo[variante], { color: corFinal }, alinhar && { textAlign: alinhar }, style]} {...props} />;
}
