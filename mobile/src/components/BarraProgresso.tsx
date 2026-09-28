import React from "react";
import { View } from "react-native";
import { useTema } from "../theme/TemaProvider";

/** Barra horizontal de 0 a 1 (ocupação de vagas, embarques). */
export function BarraProgresso({ valor, cor, fundo, altura = 8 }: { valor: number; cor?: string; fundo?: string; altura?: number }) {
  const { cores } = useTema();
  const pct = Math.max(0, Math.min(1, valor)) * 100;
  return (
    <View
      style={{ height: altura, borderRadius: altura / 2, backgroundColor: fundo ?? cores.superficieAlt, overflow: "hidden" }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View style={{ width: `${pct}%`, height: altura, borderRadius: altura / 2, backgroundColor: cor ?? cores.primaria }} />
    </View>
  );
}
